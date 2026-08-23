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

  const season = await prisma.$queryRawUnsafe<Array<{ id: string; seasonNumber: number }>>('SELECT "id", "seasonNumber" FROM "SeasonalPathSeason" WHERE "startsAt" <= CURRENT_TIMESTAMP AND "endsAt" > CURRENT_TIMESTAMP ORDER BY "seasonNumber" DESC LIMIT 1');
  if (!season[0]) return NextResponse.json({ error: "No active seasonal path." }, { status: 404 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.$queryRawUnsafe<Array<{ id: string; challengeMapId: string }>>('SELECT "id", "challengeMapId" FROM "SeasonalPathMap" WHERE "seasonId" = $1 AND "rankIndex" = $2 LIMIT 1', season[0].id, rankIndex);
      const otherMaps = await tx.$queryRawUnsafe<Array<{ challengeMapId: string }>>('SELECT "challengeMapId" FROM "SeasonalPathMap" WHERE "seasonId" = $1 AND "rankIndex" <> $2', season[0].id, rankIndex);
      const reserved = otherMaps.map((entry) => entry.challengeMapId);
      await tx.$executeRawUnsafe('DELETE FROM "SeasonalPathCompletion" WHERE "seasonId" = $1 AND "rankIndex" = $2', season[0].id, rankIndex);
      await tx.$executeRawUnsafe('DELETE FROM "SeasonalPathMap" WHERE "seasonId" = $1 AND "rankIndex" = $2', season[0].id, rankIndex);

      const range = pathRange(rankIndex);
      const autoCandidates = await tx.challengeMap.findMany({ where: { status: "approved", isAutoImported: true, id: { notIn: reserved }, rating: range }, orderBy: [{ rating: "asc" }, { createdAt: "asc" }], take: 100, select: { id: true, title: true, rating: true } });
      const approvedCandidates = autoCandidates.length > 0 ? autoCandidates : await tx.challengeMap.findMany({ where: { status: "approved", id: { notIn: reserved }, rating: range }, orderBy: [{ rating: "asc" }, { createdAt: "asc" }], take: 100, select: { id: true, title: true, rating: true } });
      const target = rankIndex === RANKS.length - 1 ? 4 : RANKS[rankIndex + 1].rangeMin;
      const map = approvedCandidates.sort((a, b) => Math.abs((a.rating ?? target) - target) - Math.abs((b.rating ?? target) - target))[0];
      if (!map) throw new Error(`No approved map is available for the ${RANKS[rankIndex].name} path slot.`);

      await tx.$executeRawUnsafe('INSERT INTO "SeasonalPathMap" ("id", "seasonId", "rankIndex", "challengeMapId") VALUES ($1, $2, $3, $4)', crypto.randomUUID(), season[0].id, rankIndex, map.id);
      return { map, previousMapId: current[0]?.challengeMapId ?? null };
    });

    return NextResponse.json({ ok: true, seasonNumber: season[0].seasonNumber, rankIndex, rankName: RANKS[rankIndex].name, previousMapId: result.previousMapId, map: result.map });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not reset the path map." }, { status: 500 });
  }
}
