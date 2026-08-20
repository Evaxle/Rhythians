import { prisma } from "@/lib/db";
import { getRankInfo, RANKS } from "@/lib/ranks";

export type RankedMapLeaderboardRow = {
  position: number;
  userId: string;
  username: string;
  displayName: string | null;
  profileHandle: string;
  avatar: string | null;
  accuracy: number | null;
  points: number;
  scoreId: number | null;
  rankInfo: ReturnType<typeof getRankInfo>;
};

export type RankedMapLeaderboard = {
  mapId: string;
  title: string;
  artist: string | null;
  description: string | null;
  mapFileUrl: string;
  imageUrl: string | null;
  rating: number;
  rankIndex: number;
  rankName: string;
  rankColor: string;
  rangeMin: number;
  rangeMax: number;
  mapperName: string | null;
  noteCount: number | null;
  length: number | null;
  sourceBeatmapId: number | null;
  sourceUrl: string | null;
  rows: RankedMapLeaderboardRow[];
};

type ScoreWrite = {
  rating: number;
  accuracy: number | null;
  passed: boolean;
  points: number;
  scoreId: number | null;
  speed: number | null;
  rankIndex: number;
};

type StoredScore = {
  id: string;
  points: number;
  accuracy: number | null;
  passed: boolean;
  scoreId: number | null;
};

async function loadMap(mapId: string) {
  return prisma.challengeMap.findUnique({
    where: { id: mapId },
    select: {
      id: true,
      title: true,
      artist: true,
      description: true,
      mapFileUrl: true,
      imageUrl: true,
      rating: true,
      mapperName: true,
      noteCount: true,
      length: true,
      sourceBeatmapId: true,
      sourceUrl: true,
      status: true,
      isAutoImported: true,
    },
  });
}

export async function getRankedMapDetail(mapId: string): Promise<RankedMapLeaderboard | null> {
  const map = await loadMap(mapId);
  if (!map || map.status !== "approved" || map.rating == null) return null;
  const rankIndex = RANKS.findIndex((rank) => map.rating! >= rank.rangeMin && map.rating! <= rank.rangeMax);
  const rank = RANKS[rankIndex === -1 ? RANKS.length - 1 : rankIndex];
  return {
    mapId: map.id,
    title: map.title,
    artist: map.artist,
    description: map.description,
    mapFileUrl: map.mapFileUrl,
    imageUrl: map.imageUrl,
    rating: map.rating,
    rankIndex: rank.index,
    rankName: rank.name,
    rankColor: rank.color,
    rangeMin: rank.rangeMin,
    rangeMax: rank.rangeMax,
    mapperName: map.mapperName,
    noteCount: map.noteCount,
    length: map.length,
    sourceBeatmapId: map.sourceBeatmapId,
    sourceUrl: map.sourceUrl,
    rows: [],
  };
}

export async function upsertRankedMapScore(mapId: string, userId: string, score: ScoreWrite) {
  const existing = await prisma.$queryRaw<StoredScore[]>`
    SELECT "id", "points", "accuracy", "passed", "scoreId"
    FROM "RankedMapScore"
    WHERE "challengeMapId" = ${mapId} AND "userId" = ${userId}
    LIMIT 1
  `;
  const current = existing[0];
  const shouldReplace = !current || score.passed !== current.passed ? score.passed : score.points > current.points || (score.points === current.points && (score.accuracy ?? -1) > (current.accuracy ?? -1));
  if (!shouldReplace) return false;
  await prisma.$executeRaw`
    INSERT INTO "RankedMapScore" ("challengeMapId", "userId", "rating", "accuracy", "passed", "points", "scoreId", "speed", "rankIndex")
    VALUES (${mapId}, ${userId}, ${score.rating}, ${score.accuracy}, ${score.passed}, ${score.points}, ${score.scoreId}, ${score.speed}, ${score.rankIndex})
    ON CONFLICT ("challengeMapId", "userId") DO UPDATE SET
      "rating" = EXCLUDED."rating",
      "accuracy" = EXCLUDED."accuracy",
      "passed" = EXCLUDED."passed",
      "points" = EXCLUDED."points",
      "scoreId" = EXCLUDED."scoreId",
      "speed" = EXCLUDED."speed",
      "rankIndex" = EXCLUDED."rankIndex",
      "updatedAt" = CURRENT_TIMESTAMP
  `;
  return true;
}

export async function getRankedMapLeaderboard(mapId: string, selectedRank: number | null, limit = 100): Promise<RankedMapLeaderboard | null> {
  const detail = await getRankedMapDetail(mapId);
  if (!detail) return null;
  const rawRows = await prisma.$queryRaw<Array<{ userId: string; username: string; displayName: string | null; profileHandle: string; avatar: string | null; accuracy: number | null; points: number; scoreId: number | null; rhp: number }>>`
    SELECT r."userId", u."username", u."displayName", u."profileHandle", u."avatar", r."accuracy", r."points", r."scoreId", u."rhp"
    FROM "RankedMapScore" r
    INNER JOIN "User" u ON u."id" = r."userId"
    WHERE r."challengeMapId" = ${mapId} AND r."passed" = true
    ORDER BY r."points" DESC, r."accuracy" DESC NULLS LAST, r."updatedAt" ASC
    LIMIT 500
  `;
  const filtered = rawRows.map((row) => ({ ...row, rankInfo: getRankInfo(row.rhp) })).filter((row) => selectedRank == null || row.rankInfo.index === selectedRank).slice(0, limit).map((row, index) => ({ position: index + 1, userId: row.userId, username: row.username, displayName: row.displayName, profileHandle: row.profileHandle, avatar: row.avatar, accuracy: row.accuracy, points: row.points, scoreId: row.scoreId, rankInfo: row.rankInfo }));
  return { ...detail, rows: filtered };
}
