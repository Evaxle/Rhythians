import { prisma } from "@/lib/db";
import { getRankInfo, RANKS, rankIndexForRating } from "@/lib/ranks";
import { analysisIsCurrent, getMapAnalysis } from "@/lib/map-analysis-store";
import { mapRankabilityBreakdown, type RankabilityBreakdown } from "@/lib/map-rankability";
import { challengeCategoryFits, CHALLENGE_FIT_LABELS, type ChallengeCategoryFit, type ChallengeFitCategory } from "@/lib/challenge-map-fit";
import type { MapPatternSegment, MapSectionAnalysis } from "@/lib/map-difficulty";

export type RankedMapLeaderboardRow = { position: number; userId: string; username: string; displayName: string | null; profileHandle: string; avatar: string | null; accuracy: number | null; points: number; scoreId: number | null; rankInfo: ReturnType<typeof getRankInfo> };
export type MapAnalysisTimelineData = { analyzerVersion: number; rating: number; rankability: number; directionScore: number; distanceScore: number; npsScore: number; staminaIndex: number; activeDurationMs: number; longestHardSectionMs: number; peakJumpNps: number; peakStreamNps: number; peakJumpStrain: number; peakStreamStrain: number; jumpRatio: number; patternSegments: MapPatternSegment[]; topSections: MapSectionAnalysis[] };
export type ChallengeAssignment = { category: ChallengeFitCategory; label: string; level: number };
export type RankedMapLeaderboard = { mapId: string; title: string; artist: string | null; description: string | null; mapFileUrl: string; imageUrl: string | null; rating: number; rankability: number; rankabilityDetails: RankabilityBreakdown; challengeFits: ChallengeCategoryFit[]; challengeAssignments: ChallengeAssignment[]; rankIndex: number; rankName: string; rankColor: string; rangeMin: number; rangeMax: number; mapperName: string | null; noteCount: number | null; length: number | null; sourceBeatmapId: number | null; sourceUrl: string | null; rpl: number; rpv: number; rps: number; rows: RankedMapLeaderboardRow[]; isRanked: boolean; isLegacy: boolean; sourceStatus: "ranked" | "unranked" | "legacy"; analysis: MapAnalysisTimelineData };
type ScoreWrite = { rating: number; accuracy: number | null; passed: boolean; points: number; scoreId: number | null; speed: number | null; rankIndex: number };

async function loadMap(mapId: string) {
  const select = { id: true, title: true, artist: true, description: true, mapFileUrl: true, imageUrl: true, rating: true, requestedRating: true, mapperName: true, noteCount: true, length: true, sourceBeatmapId: true, sourceUrl: true, status: true, isAutoImported: true, reviewerNote: true } as const;
  const direct = await prisma.challengeMap.findUnique({ where: { id: mapId }, select });
  if (direct) return direct;
  if (/^\d+$/.test(mapId)) return prisma.challengeMap.findFirst({ where: { sourceBeatmapId: Number(mapId) }, select, orderBy: { createdAt: "desc" } });
  return null;
}

async function challengeAssignmentsFor(map: { id: string; sourceBeatmapId: number | null; mapFileUrl: string; title: string }) {
  const assignments: ChallengeAssignment[] = [];
  const main = await prisma.$queryRawUnsafe<Array<{ level: number }>>('SELECT "level" FROM "ChallengeMapLevel" WHERE "challengeMapId"=$1 LIMIT 1', map.id).catch(() => []);
  if (main[0]) assignments.push({ category: "challenge", label: CHALLENGE_FIT_LABELS.challenge, level: main[0].level });
  const category = await prisma.$queryRawUnsafe<Array<{ category: string; level: number }>>(
    `SELECT "category"::text AS "category","level" FROM "CategoryMap" WHERE "status"='approved' AND (("sourceBeatmapId" IS NOT NULL AND "sourceBeatmapId"=$1) OR "mapFileUrl"=$2 OR lower("title")=lower($3)) ORDER BY "level" ASC`,
    map.sourceBeatmapId, map.mapFileUrl, map.title,
  ).catch(() => []);
  for (const row of category) {
    if (row.category === "jumps" || row.category === "stream" || row.category === "tech" || row.category === "off_grid" || row.category === "vibro") {
      assignments.push({ category: row.category, label: CHALLENGE_FIT_LABELS[row.category], level: row.level });
    }
  }
  return assignments;
}

export async function getRankedMapDetail(mapId: string): Promise<RankedMapLeaderboard | null> {
  const map = await loadMap(mapId);
  if (!map || !map.mapFileUrl || (map.status !== "approved" && map.status !== "legacy") || map.rating == null) return null;
  const analysis = await getMapAnalysis(map.id);
  if (!analysisIsCurrent(analysis) || analysis?.rating == null) return null;
  const isLegacy = analysis.sourceStatus === "legacy" || map.status === "legacy";
  const isRanked = !isLegacy && analysis.sourceStatus === "ranked" && analysis.pointEligible;
  if (isRanked && (analysis.rpl == null || analysis.rpv == null || analysis.rps == null)) return null;
  const sourceStatus: "ranked" | "unranked" | "legacy" = isLegacy ? "legacy" : isRanked ? "ranked" : "unranked";
  const rankIndex = rankIndexForRating(map.rating);
  const rank = RANKS[rankIndex] ?? RANKS[RANKS.length - 1];
  const patternSegments = (analysis.patternSegments ?? []) as MapPatternSegment[];
  const rankabilityDetails = mapRankabilityBreakdown({ noteCount: map.noteCount, activeDurationMs: analysis.activeDurationMs ?? 0, patternSegments, directionScore: analysis.directionScore ?? 0, distanceScore: analysis.distanceScore ?? 0, npsScore: analysis.npsScore ?? 0, sourceStatus });
  const rankability = rankabilityDetails.score;
  const challengeFits = challengeCategoryFits({
    rating: analysis.rating,
    directionScore: analysis.directionScore ?? 0,
    distanceScore: analysis.distanceScore ?? 0,
    npsScore: analysis.npsScore ?? 0,
    staminaIndex: analysis.staminaIndex ?? 0,
    peakJumpNps: analysis.peakJumpNps ?? 0,
    peakStreamNps: analysis.peakStreamNps ?? 0,
    peakJumpStrain: analysis.peakJumpStrain ?? 0,
    peakStreamStrain: analysis.peakStreamStrain ?? 0,
    jumpRatio: analysis.jumpRatio ?? 0,
    patternSegments,
  });
  const challengeAssignments = await challengeAssignmentsFor(map);
  const timeline: MapAnalysisTimelineData = {
    analyzerVersion: analysis.analyzerVersion, rating: analysis.rating, rankability,
    directionScore: analysis.directionScore ?? 0, distanceScore: analysis.distanceScore ?? 0, npsScore: analysis.npsScore ?? 0,
    staminaIndex: analysis.staminaIndex ?? 0, activeDurationMs: analysis.activeDurationMs ?? 0, longestHardSectionMs: analysis.longestHardSectionMs ?? 0,
    peakJumpNps: analysis.peakJumpNps ?? 0, peakStreamNps: analysis.peakStreamNps ?? 0, peakJumpStrain: analysis.peakJumpStrain ?? 0,
    peakStreamStrain: analysis.peakStreamStrain ?? 0, jumpRatio: analysis.jumpRatio ?? 0, patternSegments,
    topSections: (analysis.topSections ?? []) as MapSectionAnalysis[],
  };
  return { mapId: map.id, title: map.title, artist: map.artist, description: map.description, mapFileUrl: map.mapFileUrl, imageUrl: map.imageUrl, rating: map.rating, rankability, rankabilityDetails, challengeFits, challengeAssignments, rankIndex: rank.index, rankName: rank.name, rankColor: rank.color, rangeMin: rank.rangeMin, rangeMax: rank.rangeMax, mapperName: map.mapperName, noteCount: map.noteCount, length: map.length, sourceBeatmapId: map.sourceBeatmapId, sourceUrl: map.sourceUrl, rpl: analysis.rpl ?? 0, rpv: analysis.rpv ?? 0, rps: analysis.rps ?? 0, rows: [], isRanked, isLegacy, sourceStatus, analysis: timeline };
}

export async function upsertRankedMapScore(mapId: string, userId: string, score: ScoreWrite) {
  const detail = await getRankedMapDetail(mapId);
  if (!detail?.isRanked) return false;
  const existing = await prisma.challengeMapCompletion.findUnique({ where: { challengeMapId_userId: { challengeMapId: detail.mapId, userId } } });
  const shouldReplace = !existing || score.passed !== existing.passed ? score.passed : score.points > existing.points || score.points === existing.points && (score.accuracy ?? -1) > (existing.accuracy ?? -1);
  if (!shouldReplace) return false;
  await prisma.challengeMapCompletion.upsert({ where: { challengeMapId_userId: { challengeMapId: detail.mapId, userId } }, create: { challengeMapId: detail.mapId, userId, rating: detail.rating, accuracy: score.accuracy, passed: score.passed, points: score.points, scoreId: score.scoreId }, update: { rating: detail.rating, accuracy: score.accuracy, passed: score.passed, points: score.points, scoreId: score.scoreId } });
  return true;
}

export async function getRankedMapLeaderboard(mapId: string, _selectedRank: number | null, limit = 100): Promise<RankedMapLeaderboard | null> {
  const detail = await getRankedMapDetail(mapId);
  if (!detail) return null;
  if (!detail.isRanked) return detail;
  const completions = await prisma.challengeMapCompletion.findMany({ where: { challengeMapId: detail.mapId, passed: true }, include: { user: { select: { id: true, username: true, displayName: true, profileHandle: true, avatar: true, rhp: true } } } });
  const eligible = completions.filter((entry) => getRankInfo(entry.user.rhp).index === detail.rankIndex).sort((a, b) => (b.accuracy ?? -1) - (a.accuracy ?? -1) || b.points - a.points || a.updatedAt.getTime() - b.updatedAt.getTime()).slice(0, Math.max(1, Math.min(500, limit)));
  const rows = eligible.map((entry, index) => ({ position: index + 1, userId: entry.user.id, username: entry.user.username, displayName: entry.user.displayName, profileHandle: entry.user.profileHandle, avatar: entry.user.avatar, accuracy: entry.accuracy, points: entry.points, scoreId: entry.scoreId, rankInfo: getRankInfo(entry.user.rhp) }));
  return { ...detail, rows };
}
