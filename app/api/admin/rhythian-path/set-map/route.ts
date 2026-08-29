import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/db";
import { RANKS } from "@/lib/ranks";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canAccessAdmin(user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null) as { rankIndex?: unknown; challengeMapId?: unknown } | null;
  const rankIndex = Number(body?.rankIndex);
  const challengeMapId = typeof body?.challengeMapId === "string" ? body.challengeMapId : "";
  if (!Number.isInteger(rankIndex) || rankIndex < 0 || rankIndex >= RANKS.length) return NextResponse.json({ error: "Invalid path rank." }, { status: 400 });
  if (!challengeMapId) return NextResponse.json({ error: "A map is required." }, { status: 400 });

  const season = await prisma.$queryRawUnsafe<Array<{ id: string; seasonNumber: number }>>('SELECT "id", "seasonNumber" FROM "SeasonalPathSeason" WHERE "startsAt" <= CURRENT_TIMESTAMP AND "endsAt" > CURRENT_TIMESTAMP ORDER BY "seasonNumber" DESC LIMIT 1');
  if (!season[0]) return NextResponse.json({ error: "No active seasonal path." }, { status: 404 });

  const map = await prisma.challengeMap.findUnique({ where: { id: challengeMapId }, select: { id: true, title: true, artist: true, rating: true, mapperName: true, status: true } });
  if (!map || map.status !== "approved") return NextResponse.json({ error: "Only approved maps can be assigned to the Rhythian Path." }, { status: 400 });

  try {
    await prisma.$transaction(async (tx) => {
      const duplicate = await tx.$queryRawUnsafe<Array<{ rankIndex: number }>>('SELECT "rankIndex" FROM "SeasonalPathMap" WHERE "seasonId" = $1 AND "challengeMapId" = $2 AND "rankIndex" <> $3 LIMIT 1', season[0].id, challengeMapId, rankIndex);
      if (duplicate[0]) throw new Error("That map is already assigned to another rank in this season.");
      await tx.$executeRawUnsafe('DELETE FROM "SeasonalPathCompletion" WHERE "seasonId" = $1 AND "rankIndex" >= $2', season[0].id, rankIndex);
      await tx.$executeRawUnsafe('DELETE FROM "SeasonalPathMap" WHERE "seasonId" = $1 AND "rankIndex" = $2', season[0].id, rankIndex);
      await tx.$executeRawUnsafe('INSERT INTO "SeasonalPathMap" ("id", "seasonId", "rankIndex", "challengeMapId") VALUES ($1, $2, $3, $4)', crypto.randomUUID(), season[0].id, rankIndex, challengeMapId);
    });

    return NextResponse.json({ ok: true, seasonNumber: season[0].seasonNumber, rankIndex, rankName: RANKS[rankIndex].name, map });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not assign the path map." }, { status: 500 });
  }
}
