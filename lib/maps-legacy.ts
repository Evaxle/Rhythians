import { prisma } from "@/lib/db";
import { RANKS, getRankInfo, rankIndexForRating, type RankInfo } from "@/lib/ranks";
import { ensureMapAnalysisTable, MAP_ANALYZER_VERSION } from "@/lib/map-analysis-store";
import { checkAllRankedMaps as syncAllRankedMaps } from "@/lib/ranked-map-check";
import { getRankedMapLeaderboard } from "@/lib/ranked-map-leaderboard";

function normalizeTitle(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function mapScoreKey(map: { id: string; sourceBeatmapId: number | null }) {
  return map.sourceBeatmapId != null ? `rhythia:${map.sourceBeatmapId}` : `map:${map.id}`;
}

type AnalysisRow = {
  mapId: string;
  pointEligible: boolean;
  sourceStatus: string;
  rpl: number;
  rpv: number;
  rps: number;
};

async function currentAnalyses() {
  await ensureMapAnalysisTable();
  return prisma.$queryRawUnsafe<AnalysisRow[]>(
    `SELECT "mapId","pointEligible","sourceStatus","rpl","rpv","rps"
     FROM "MapDifficultyAnalysis"
     WHERE status='analyzed' AND "analyzerVersion"=$1`,
    MAP_ANALYZER_VERSION,
  );
}

export async function getUserGlobalRank(userId: string): Promise<number | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { rhp: true } });
  if (!user) return null;
  return (await prisma.user.count({
    where: { rhp: { gt: user.rhp }, NOT: { profileHandle: "rhythia-imports" } },
  })) + 1;
}

export async function checkAllRankedMaps(userId: string) {
  return syncAllRankedMaps(userId);
}

export async function getChallengeLeaderboard(rankIndex: number, limit = 100) {
  const rank = RANKS[rankIndex];
  if (!rank) return [];

  const minRhp = rank.minRhp;
  const maxRhp = rankIndex < RANKS.length - 1 ? RANKS[rankIndex + 1].minRhp : null;
  const users = await prisma.user.findMany({
    where: {
      rhp: maxRhp == null ? { gte: minRhp } : { gte: minRhp, lt: maxRhp },
      NOT: { profileHandle: "rhythia-imports" },
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      profileHandle: true,
      avatar: true,
      rhp: true,
      avgMapRating: true,
    },
    orderBy: { rhp: "desc" },
    take: limit,
  });

  const completionCounts = await prisma.challengeMapCompletion.groupBy({
    by: ["userId"],
    where: { userId: { in: users.map((user) => user.id) }, passed: true },
    _count: { _all: true },
  });
  const countMap = new Map(completionCounts.map((entry) => [entry.userId, entry._count._all]));

  return users.map((user, index) => ({
    position: index + 1,
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    profileHandle: user.profileHandle,
    avatar: user.avatar,
    rhp: user.rhp,
    avgMapRating: user.avgMapRating,
    completions: countMap.get(user.id) ?? 0,
    rankInfo: getRankInfo(user.rhp),
  }));
}

export async function getApprovedMaps(_includeAll: boolean, userId: string | null, includeUnranked = false) {
  const analyses = await currentAnalyses();
  const analysisByMap = new Map(analyses.map((row) => [row.mapId, row]));
  const allowedIds = analyses
    .filter((row) => row.pointEligible || row.sourceStatus === "legacy" || includeUnranked)
    .map((row) => row.mapId);

  const maps = allowedIds.length
    ? await prisma.challengeMap.findMany({
      where: {
        id: { in: allowedIds },
        status: { in: ["approved", "legacy"] },
        rating: { not: null },
      },
      orderBy: [{ rating: "asc" }, { createdAt: "desc" }],
      include: {
        submittedBy: {
          select: { username: true, displayName: true, profileHandle: true, avatar: true },
        },
        reviewedBy: {
          select: { username: true, displayName: true, profileHandle: true, avatar: true },
        },
      },
    })
    : [];

  const completionState = userId && maps.length
    ? await prisma.challengeMapCompletion.findMany({
      where: { userId, challengeMapId: { in: maps.map((map) => map.id) } },
      select: { challengeMapId: true, passed: true, points: true },
    })
    : [];
  const stateMap = new Map(completionState.map((entry) => [entry.challengeMapId, entry]));

  let scoredKeys = new Set<string>();
  let scoredTitles = new Set<string>();
  if (userId) {
    const rows = await prisma.rhythiaModeScore.findMany({
      where: { userId },
      select: { mapKey: true, mapTitle: true },
    });
    scoredKeys = new Set(rows.map((row) => row.mapKey).filter(Boolean));
    scoredTitles = new Set(rows.map((row) => normalizeTitle(row.mapTitle)).filter(Boolean));
  }

  const user = userId
    ? await prisma.user.findUnique({ where: { id: userId }, select: { rhp: true } })
    : null;
  const rankInfo: RankInfo | null = user ? getRankInfo(user.rhp) : null;

  return {
    rankInfo,
    maps: maps.map((map) => {
      const analysis = analysisByMap.get(map.id);
      const mapRankIndex = rankIndexForRating(map.rating ?? 0);
      const sourceStatus = analysis?.sourceStatus ?? (map.status === "legacy" ? "legacy" : "ranked");
      const isLegacy = sourceStatus === "legacy" || map.status === "legacy";
      const isRanked = !isLegacy && sourceStatus === "ranked" && Boolean(analysis?.pointEligible);
      const rank = RANKS[mapRankIndex] ?? RANKS[RANKS.length - 1];
      const maxRewards = isRanked && analysis
        ? {
          lock: Number(analysis.rpl) || 0,
          spin: Number(analysis.rps) || 0,
          vr: Number(analysis.rpv) || 0,
        }
        : null;
      const scoreKey = mapScoreKey(map);
      const hasScore = scoredKeys.has(scoreKey) || scoredTitles.has(normalizeTitle(map.title));

      return {
        id: map.id,
        title: map.title,
        artist: map.artist,
        description: map.description,
        mapFileUrl: map.mapFileUrl,
        imageUrl: map.imageUrl,
        rating: map.rating,
        rankIndex: mapRankIndex,
        rankName: isLegacy ? `${rank.name} Legacy` : isRanked ? rank.name : "Unranked",
        rankColor: isLegacy ? rank.color : isRanked ? rank.color : "#f59e0b",
        mapperName: map.mapperName,
        noteCount: map.noteCount,
        length: map.length,
        sourceBeatmapId: map.sourceBeatmapId,
        scoreKey,
        submittedBy: map.submittedBy,
        reviewedBy: map.reviewedBy,
        completion: stateMap.get(map.id) ?? null,
        hasScore,
        isAutoImported: map.isAutoImported,
        isRanked,
        isLegacy,
        sourceStatus,
        maxRewards,
      };
    }),
  };
}

export async function getMapLeaderboard(mapId: string) {
  return getRankedMapLeaderboard(mapId, null, 100);
}

export async function resetUserRankedStatus(userId: string) {
  await prisma.$transaction([
    prisma.challengeMapCompletion.deleteMany({ where: { userId } }),
    prisma.rhythiaModeScore.deleteMany({ where: { userId } }),
    prisma.rhpTransaction.deleteMany({ where: { userId } }),
    prisma.user.update({
      where: { id: userId },
      data: { rhp: 0, avgMapRating: null, scoreImportDone: false },
    }),
  ]);

  await prisma.$executeRawUnsafe(
    `DELETE FROM "UserPointOverride" WHERE "userId"=$1 AND system IN ('rhp','rpl','rps','rpv')`,
    userId,
  ).catch(() => 0);

  return { ok: true };
}
