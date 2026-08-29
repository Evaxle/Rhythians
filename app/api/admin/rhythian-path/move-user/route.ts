import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { RANKS } from "@/lib/ranks";

export const dynamic = "force-dynamic";

type Direction = "up" | "down";

export async function PATCH(request: Request) {
  const admin = await getSessionUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canAccessAdmin(admin))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null) as { userId?: unknown; direction?: unknown } | null;
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const direction = body?.direction === "up" || body?.direction === "down" ? body.direction : null;
  if (!userId) return NextResponse.json({ error: "A user is required." }, { status: 400 });
  if (!direction) return NextResponse.json({ error: "Invalid direction." }, { status: 400 });

  const season = await prisma.$queryRawUnsafe<Array<{ id: string; seasonNumber: number }>>('SELECT "id", "seasonNumber" FROM "SeasonalPathSeason" WHERE "startsAt" <= CURRENT_TIMESTAMP AND "endsAt" > CURRENT_TIMESTAMP ORDER BY "seasonNumber" DESC LIMIT 1');
  if (!season[0]) return NextResponse.json({ error: "No active seasonal path." }, { status: 404 });

  const completions = await prisma.$queryRawUnsafe<Array<{ rankIndex: number }>>('SELECT "rankIndex" FROM "SeasonalPathCompletion" WHERE "seasonId" = $1 AND "userId" = $2 ORDER BY "rankIndex" ASC', season[0].id, userId);
  const currentRank = completions.length ? Math.max(...completions.map((entry) => entry.rankIndex)) : -1;
  const targetRank = direction === "up" ? currentRank + 1 : currentRank - 1;

  if (targetRank < -1 || targetRank >= RANKS.length) return NextResponse.json({ error: "That move is not available." }, { status: 400 });
  if (direction === "down" && currentRank < 0) return NextResponse.json({ error: "The player has not started the path." }, { status: 400 });
  if (direction === "up" && currentRank >= RANKS.length - 1) return NextResponse.json({ error: "The player is already at the highest path rank." }, { status: 400 });

  const targetMap = targetRank >= 0 ? await prisma.$queryRawUnsafe<Array<{ id: string }>>('SELECT "id" FROM "SeasonalPathMap" WHERE "seasonId" = $1 AND "rankIndex" = $2 LIMIT 1', season[0].id, targetRank) : [];
  if (direction === "up" && !targetMap[0]) return NextResponse.json({ error: "The destination path rank does not have a map assigned." }, { status: 400 });

  await prisma.$transaction(async (tx) => {
    if (direction === "up") {
      await tx.$executeRawUnsafe('INSERT INTO "SeasonalPathCompletion" ("id", "seasonId", "userId", "rankIndex", "seasonalPathMapId", "scoreId") VALUES ($1, $2, $3, $4, $5, NULL) ON CONFLICT ("seasonId", "userId", "rankIndex") DO NOTHING', randomUUID(), season[0].id, userId, targetRank, targetMap[0].id);
    } else {
      await tx.$executeRawUnsafe('DELETE FROM "SeasonalPathCompletion" WHERE "seasonId" = $1 AND "userId" = $2 AND "rankIndex" >= $3', season[0].id, userId, currentRank);
    }
    await tx.moderationAction.create({
      data: {
        actorId: admin.id,
        action: direction === "up" ? "seasonal_path_rank_increased" : "seasonal_path_rank_decreased",
        targetType: "user",
        targetId: userId,
        metadata: { seasonId: season[0].id, seasonNumber: season[0].seasonNumber, fromRank: currentRank, toRank: direction === "up" ? targetRank : targetRank },
      },
    });
  });

  return NextResponse.json({ ok: true, seasonNumber: season[0].seasonNumber, fromRank: currentRank, toRank: targetRank });
}
