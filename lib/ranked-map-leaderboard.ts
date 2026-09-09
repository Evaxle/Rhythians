import { prisma } from "@/lib/db";
import { getRankInfo, RANKS, rankIndexForRating } from "@/lib/ranks";
import { analysisIsCurrent, getMapAnalysis } from "@/lib/map-analysis-store";

export type RankedMapLeaderboardRow = { position: number; userId: string; username: string; displayName: string | null; profileHandle: string; avatar: string | null; accuracy: number | null; points: number; scoreId: number | null; rankInfo: ReturnType<typeof getRankInfo> };
export type RankedMapLeaderboard = { mapId: string; title: string; artist: string | null; description: string | null; mapFileUrl: string; imageUrl: string | null; rating: number; rankIndex: number; rankName: string; rankColor: string; rangeMin: number; rangeMax: number; mapperName: string | null; noteCount: number | null; length: number | null; sourceBeatmapId: number | null; sourceUrl: string | null; rpl: number; rpv: number; rps: number; rows: RankedMapLeaderboardRow[]; isRanked?: boolean };
type ScoreWrite = { rating: number; accuracy: number | null; passed: boolean; points: number; scoreId: number | null; speed: number | null; rankIndex: number };

async function loadMap(mapId: string) {
  const select = { id: true, title: true, artist: true, description: true, mapFileUrl: true, imageUrl: true, rating: true, requestedRating: true, mapperName: true, noteCount: true, length: true, sourceBeatmapId: true, sourceUrl: true, status: true, isAutoImported: true, reviewerNote: true } as const;
  const direct = await prisma.challengeMap.findUnique({ where: { id: mapId }, select });
  if (direct) return direct;
  if (/^\d+$/.test(mapId)) return prisma.challengeMap.findFirst({ where: { sourceBeatmapId: Number(mapId) }, select, orderBy: { createdAt: "desc" } });
  return null;
}

export async function getRankedMapDetail(mapId: string): Promise<RankedMapLeaderboard | null> {
  const map = await loadMap(mapId);
  if (!map || !map.mapFileUrl || map.status !== "approved" || map.rating == null) return null;
  const analysis = await getMapAnalysis(map.id);
  if (!analysisIsCurrent(analysis) || !analysis?.pointEligible || analysis.rpl == null || analysis.rpv == null || analysis.rps == null) return null;
  const rankIndex = rankIndexForRating(map.rating);
  const rank = RANKS[rankIndex] ?? RANKS[RANKS.length - 1];
  return { mapId: map.id, title: map.title, artist: map.artist, description: map.description, mapFileUrl: map.mapFileUrl, imageUrl: map.imageUrl, rating: map.rating, rankIndex: rank.index, rankName: rank.name, rankColor: rank.color, rangeMin: rank.rangeMin, rangeMax: rank.rangeMax, mapperName: map.mapperName, noteCount: map.noteCount, length: map.length, sourceBeatmapId: map.sourceBeatmapId, sourceUrl: map.sourceUrl, rpl: analysis.rpl, rpv: analysis.rpv, rps: analysis.rps, rows: [], isRanked: true };
}

export async function upsertRankedMapScore(mapId: string, userId: string, score: ScoreWrite) {
  const detail = await getRankedMapDetail(mapId);
  if (!detail || detail.rankIndex !== score.rankIndex) return false;
  const existing = await prisma.challengeMapCompletion.findUnique({ where: { challengeMapId_userId: { challengeMapId: detail.mapId, userId } } });
  const shouldReplace = !existing || score.passed !== existing.passed ? score.passed : score.points > existing.points || score.points === existing.points && (score.accuracy ?? -1) > (existing.accuracy ?? -1);
  if (!shouldReplace) return false;
  await prisma.challengeMapCompletion.upsert({ where: { challengeMapId_userId: { challengeMapId: detail.mapId, userId } }, create: { challengeMapId: detail.mapId, userId, rating: detail.rating, accuracy: score.accuracy, passed: score.passed, points: score.points, scoreId: score.scoreId }, update: { rating: detail.rating, accuracy: score.accuracy, passed: score.passed, points: score.points, scoreId: score.scoreId } });
  return true;
}

export async function getRankedMapLeaderboard(mapId: string, _selectedRank: number | null, limit = 100): Promise<RankedMapLeaderboard | null> {
  const detail = await getRankedMapDetail(mapId);
  if (!detail) return null;
  const completions = await prisma.challengeMapCompletion.findMany({ where: { challengeMapId: detail.mapId, passed: true }, include: { user: { select: { id: true, username: true, displayName: true, profileHandle: true, avatar: true, rhp: true } } } });
  const eligible = completions.filter((entry) => getRankInfo(entry.user.rhp).index === detail.rankIndex).sort((a, b) => (b.accuracy ?? -1) - (a.accuracy ?? -1) || b.points - a.points || a.updatedAt.getTime() - b.updatedAt.getTime()).slice(0, Math.max(1, Math.min(500, limit)));
  const rows = eligible.map((entry, index) => ({ position: index + 1, userId: entry.user.id, username: entry.user.username, displayName: entry.user.displayName, profileHandle: entry.user.profileHandle, avatar: entry.user.avatar, accuracy: entry.accuracy, points: entry.points, scoreId: entry.scoreId, rankInfo: getRankInfo(entry.user.rhp) }));
  return { ...detail, rows };
}
