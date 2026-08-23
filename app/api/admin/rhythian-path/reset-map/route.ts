import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/db";
import { RANKS } from "@/lib/ranks";

export const dynamic = "force-dynamic";

function pathRange(rankIndex: number) {
  if (rankIndex === RANKS.length - 1) return { gte: 4 };
  return { gte: RANKS[rankIndex + 1].rangeMin, lte: RANKS[rankIndex + 1].rangeMax };
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canAccessAdmin(user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as { rankIndex?: unknown } | null;
  const rankIndex = Number(body?.rankIndex);
  if (!Number.isInteger(rankIndex) || rankIndex < 0 || rankIndex >= RANKS.length) return NextResponse.json({ error: "Invalid path rank." }, { status: 400 });
  const season = await prisma.$queryRawUnsafe<Array<{ id: string }>>('SELECT "id" FROM "SeasonalPathSeason" WHERE "startsAt" <= CURRENT_TIMESTAMP AND "endsAt" > CURRENT_TIMESTAMP ORDER BY "seasonNumber" DESC LIMIT 1');
  if (!season[0]) return NextResponse.json({ error: "No active seasonal path." }, { status: 404 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.$queryRawUnsafe<Array<{ challengeMapId: string }>>('SELECT "challengeMapId" FROM "SeasonalPathMap" WHERE "seasonId" = $1', season[0].id);
      const keepIds = existing.map((entry) => entry.challengeMapId);
      const oldRows = await tx.$queryRawUnsafe<Array<{ rankIndex: number; challengeMapId: string }>>('SELECT "rankIndex", "challengeMapId" FROM "SeasonalPathMap" WHERE "seasonId" = $1 AND "rankIndex" >= $2 ORDER BY "rankIndex" ASC', season[0].id, rankIndex);
      await tx.$executeRawUnsafe('DELETE FROM "SeasonalPathCompletion" WHERE "seasonId" = $1 AND "rankIndex" >= $2', season[0].id, rankIndex);
      await tx.$executeRawUnsafe('DELETE FROM "SeasonalPathMap" WHERE "seasonId" = $1 AND "rankIndex" >= $2', season[0].id, rankIndex);

      const reserved = new Set(keepIds.filter((id) => !oldRows.some((row) => row.challengeMapId === id)));
      const assignments: Array<{ rankIndex: number; map: { id: string; title: string; rating: number | null } }> = [];
      for (let index = rankIndex; index < RANKS.length; index += 1) {
        const range = pathRange(index);
        const candidates = await tx.challengeMap.findMany({ where: { status: "approved", isAutoImported: true, id: { notIn: [...reserved] }, rating: range }, orderBy: [{ rating: "asc" }, { createdAt: "asc" }], take: 100, select: { id: true, title: true, rating: true } });
        const target = index === RANKS.length - 1 ? 4 : RANKS[index + 1].rangeMin;
        const map = candidates.sort((a, b) => Math.abs((a.rating ?? target) - target) - Math.abs((b.rating ?? target) - target))[0];
        if (!map) continue;
        await tx.$executeRawUnsafe('INSERT INTO "SeasonalPathMap" ("id", "seasonId", "rankIndex", "challengeMapId") VALUES ($1, $2, $3, $4)', crypto.randomUUID(), season[0].id, index, map.id);
        reserved.add(map.id);
        assignments.push({ rankIndex: index, map });
      }
      return assignments;
    });

    const assigned = result.find((entry) => entry.rankIndex === rankIndex);
    if (!assigned) return NextResponse.json({ error: `No approved auto-imported map is available for ${RANKS[rankIndex].name}.` }, { status: 409 });
    return NextResponse.json({ ok: true, rankIndex, resetThroughRank: RANKS.length - 1, map: assigned.map, assignments: result.map((entry) => ({ rankIndex: entry.rankIndex, id: entry.map.id, title: entry.map.title, rating: entry.map.rating })) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not reset the path map." }, { status: 500 });
  }
}
