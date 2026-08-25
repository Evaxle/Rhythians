import { prisma } from "@/lib/db";
import { getRankInfo, RANKS } from "@/lib/ranks";

export type RankedMapLeaderboardRow = { position: number; userId: string; username: string; displayName: string | null; profileHandle: string; avatar: string | null; accuracy: number | null; points: number; scoreId: number | null; rankInfo: ReturnType<typeof getRankInfo> };
export type RankedMapLeaderboard = { mapId: string; title: string; artist: string | null; description: string | null; mapFileUrl: string; imageUrl: string | null; rating: number; rankIndex: number; rankName: string; rankColor: string; rangeMin: number; rangeMax: number; mapperName: string | null; noteCount: number | null; length: number | null; sourceBeatmapId: number | null; sourceUrl: string | null; rows: RankedMapLeaderboardRow[]; isRanked?: boolean };
type ScoreWrite = { rating: number; accuracy: number | null; passed: boolean; points: number; scoreId: number | null; speed: number | null; rankIndex: number };
type StoredScore = { id: string; points: number; accuracy: number | null; passed: boolean; scoreId: number | null };

async function loadMap(mapId: string) {
  const select = { id: true, title: true, artist: true, description: true, mapFileUrl: true, imageUrl: true, rating: true, requestedRating: true, mapperName: true, noteCount: true, length: true, sourceBeatmapId: true, sourceUrl: true, status: true, isAutoImported: true, reviewerNote: true } as const;
  const direct = await prisma.challengeMap.findUnique({ where: { id: mapId }, select });
  if (direct) return direct;
  if (/^\d+$/.test(mapId)) return prisma.challengeMap.findFirst({ where: { sourceBeatmapId: Number(mapId) }, select, orderBy: { createdAt: "desc" } });
  return null;
}

export async function getRankedMapDetail(mapId: string): Promise<RankedMapLeaderboard | null> {
  const map = await loadMap(mapId);
  if (!map || !map.mapFileUrl || map.status !== "approved" || map.rating == null || map.reviewerNote === "rhythia-unranked") return null;
  const rating = map.rating;
  const rankIndex = RANKS.findIndex((rank) => rating >= rank.rangeMin && rating <= rank.rangeMax);
  const rank = RANKS[rankIndex === -1 ? RANKS.length - 1 : rankIndex];
  return { mapId: map.id, title: map.title, artist: map.artist, description: map.description, mapFileUrl: map.mapFileUrl, imageUrl: map.imageUrl, rating, rankIndex: rank.index, rankName: rank.name, rankColor: rank.color, rangeMin: rank.rangeMin, rangeMax: rank.rangeMax, mapperName: map.mapperName, noteCount: map.noteCount, length: map.length, sourceBeatmapId: map.sourceBeatmapId, sourceUrl: map.sourceUrl, rows: [], isRanked: true };
}

export async function upsertRankedMapScore(mapId: string, userId: string, score: ScoreWrite) {
  const detail = await getRankedMapDetail(mapId);
  if (!detail || detail.rankIndex !== score.rankIndex) { await prisma.$executeRaw`DELETE FROM "RankedMapScore" WHERE "challengeMapId" = ${mapId} AND "userId" = ${userId}`; return false; }
  const currentRank = await prisma.user.findUnique({ where: { id: userId }, select: { rhp: true } });
  if (!currentRank || getRankInfo(currentRank.rhp).index !== detail.rankIndex) { await prisma.$executeRaw`DELETE FROM "RankedMapScore" WHERE "challengeMapId" = ${mapId} AND "userId" = ${userId}`; return false; }
  const existing = await prisma.$queryRaw<StoredScore[]>`SELECT "id", "points", "accuracy", "passed", "scoreId" FROM "RankedMapScore" WHERE "challengeMapId" = ${mapId} AND "userId" = ${userId} LIMIT 1`;
  const current = existing[0];
  const shouldReplace = !current || score.passed !== current.passed ? score.passed : score.points > current.points || (score.points === current.points && (score.accuracy ?? -1) > (current.accuracy ?? -1));
  if (!shouldReplace) return false;
  await prisma.$executeRaw`INSERT INTO "RankedMapScore" ("challengeMapId", "userId", "rating", "accuracy", "passed", "points", "scoreId", "speed", "rankIndex") VALUES (${mapId}, ${userId}, ${score.rating}, ${score.accuracy}, ${score.passed}, ${score.points}, ${score.scoreId}, ${score.speed}, ${score.rankIndex}) ON CONFLICT ("challengeMapId", "userId") DO UPDATE SET "rating" = EXCLUDED."rating", "accuracy" = EXCLUDED."accuracy", "passed" = EXCLUDED."passed", "points" = EXCLUDED."points", "scoreId" = EXCLUDED."scoreId", "speed" = EXCLUDED."speed", "rankIndex" = EXCLUDED."rankIndex", "updatedAt" = CURRENT_TIMESTAMP`;
  return true;
}

export async function getRankedMapLeaderboard(mapId: string, _selectedRank: number | null, limit = 100): Promise<RankedMapLeaderboard | null> {
  const detail = await getRankedMapDetail(mapId);
  if (!detail) return null;
  await prisma.$executeRaw`DELETE FROM "RankedMapScore" r USING "User" u WHERE r."challengeMapId" = ${detail.mapId} AND r."userId" = u."id" AND (r."rankIndex" <> ${detail.rankIndex} OR (SELECT FLOOR(u."rhp" / 500)) <> r."rankIndex")`;
  const rawRows = await prisma.$queryRaw<Array<{ userId: string; username: string; displayName: string | null; profileHandle: string; avatar: string | null; accuracy: number | null; points: number; scoreId: number | null; rhp: number }>>`SELECT r."userId", u."username", u."displayName", u."profileHandle", u."avatar", r."accuracy", r."points", r."scoreId", u."rhp" FROM "RankedMapScore" r INNER JOIN "User" u ON u."id" = r."userId" WHERE r."challengeMapId" = ${detail.mapId} AND r."passed" = true AND r."rankIndex" = ${detail.rankIndex} AND FLOOR(u."rhp" / 500) = ${detail.rankIndex} ORDER BY r."points" DESC, r."accuracy" DESC NULLS LAST, r."updatedAt" ASC LIMIT 500`;
  const rows = rawRows.map((row) => ({ ...row, rankInfo: getRankInfo(row.rhp) })).slice(0, limit).map((row, index) => ({ position: index + 1, userId: row.userId, username: row.username, displayName: row.displayName, profileHandle: row.profileHandle, avatar: row.avatar, accuracy: row.accuracy, points: row.points, scoreId: row.scoreId, rankInfo: row.rankInfo }));
  return { ...detail, rows };
}
