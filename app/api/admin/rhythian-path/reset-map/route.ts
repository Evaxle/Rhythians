import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { RANKS } from "@/lib/ranks";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canAccessAdmin(user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { rankIndex?: unknown } | null;
  const rankIndex = Number(body?.rankIndex);
  if (!Number.isInteger(rankIndex) || rankIndex < 0 || rankIndex >= RANKS.length) return NextResponse.json({ error: "Invalid path rank." }, { status: 400 });

  const season = await prisma.$queryRawUnsafe<Array<{ id: string }>>('SELECT "id" FROM "SeasonalPathSeason" WHERE "startsAt" <= CURRENT_TIMESTAMP AND "endsAt" > CURRENT_TIMESTAMP ORDER BY "seasonNumber" DESC LIMIT 1');
  if (!season[0]) return NextResponse.json({ error: "No active seasonal path." }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('DELETE FROM "SeasonalPathCompletion" WHERE "seasonId" = $1 AND "rankIndex" >= $2', season[0].id, rankIndex);
    await tx.$executeRawUnsafe('DELETE FROM "SeasonalPathMap" WHERE "seasonId" = $1 AND "rankIndex" = $2', season[0].id, rankIndex);
  });

  return NextResponse.json({ ok: true, rankIndex });
}
