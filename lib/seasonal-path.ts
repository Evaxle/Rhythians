import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { fetchRhythiaScores, findScoreForMap } from "@/lib/daily";
import { RANKS } from "@/lib/ranks";

const RANK_NAMES = RANKS.map((rank) => rank.name);

function addThreeMonths(date: Date) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + 3);
  return next;
}

function pathTargetRating(rankIndex: number) {
  return rankIndex === RANKS.length - 1 ? 4 : RANKS[rankIndex + 1].rangeMin;
}

async function ensureCurrentSeason() {
  const now = new Date();
  const active = await prisma.$queryRawUnsafe<Array<{ id: string; seasonNumber: number; startsAt: Date; endsAt: Date }>>('SELECT "id", "seasonNumber", "startsAt", "endsAt" FROM "SeasonalPathSeason" WHERE "startsAt" <= $1 AND "endsAt" > $1 ORDER BY "seasonNumber" DESC LIMIT 1', now);
  if (active[0]) return active[0];
  const latest = await prisma.$queryRawUnsafe<Array<{ seasonNumber: number; endsAt: Date }>>('SELECT "seasonNumber", "endsAt" FROM "SeasonalPathSeason" ORDER BY "seasonNumber" DESC LIMIT 1');
  const start = latest[0]?.endsAt && latest[0].endsAt <= now ? latest[0].endsAt : now;
  const seasonNumber = (latest[0]?.seasonNumber ?? 0) + 1;
  await prisma.$executeRawUnsafe('INSERT INTO "SeasonalPathSeason" ("id", "seasonNumber", "startsAt", "endsAt") VALUES ($1, $2, $3, $4) ON CONFLICT ("seasonNumber") DO NOTHING', randomUUID(), seasonNumber, start, addThreeMonths(start));
  return ensureCurrentSeason();
}

async function awardSeasonTags(seasonId: string, seasonNumber: number) {
  const users = await prisma.$queryRawUnsafe<Array<{ userId: string; maxRank: number }>>('SELECT "userId", MAX("rankIndex")::int AS "maxRank" FROM "SeasonalPathCompletion" WHERE "seasonId" = $1 GROUP BY "userId"', seasonId);
  for (const user of users) {
    for (let index = 0; index <= Math.min(RANKS.length - 1, user.maxRank); index += 1) {
      const name = `Season ${seasonNumber} ${RANK_NAMES[index]}`;
      const slug = name.toLowerCase().replaceAll(" ", "-");
      const tag = await prisma.tag.upsert({ where: { slug }, update: { name }, create: { name, slug } });
      await prisma.userTag.upsert({ where: { userId_tagId: { userId: user.userId, tagId: tag.id } }, update: { source: "manual" }, create: { userId: user.userId, tagId: tag.id, source: "manual" } });
    }
  }
}

async function finalizeExpiredSeasons() {
  const expired = await prisma.$queryRawUnsafe<Array<{ id: string; seasonNumber: number }>>('SELECT "id", "seasonNumber" FROM "SeasonalPathSeason" WHERE "endsAt" <= $1 ORDER BY "seasonNumber" ASC', new Date());
  for (const season of expired) await awardSeasonTags(season.id, season.seasonNumber);
}

async function ensureSeasonMaps(seasonId: string) {
  const existing = await prisma.$queryRawUnsafe<Array<{ id: string; rankIndex: number; challengeMapId: string }>>('SELECT "id", "rankIndex", "challengeMapId" FROM "SeasonalPathMap" WHERE "seasonId" = $1 ORDER BY "rankIndex" ASC', seasonId);
  const byRank = new Map(existing.map((entry) => [entry.rankIndex, entry]));
  for (let rankIndex = 0; rankIndex < RANKS.length; rankIndex += 1) {
    if (byRank.has(rankIndex)) continue;
    const target = pathTargetRating(rankIndex);
    const range = rankIndex === RANKS.length - 1 ? { gte: 3.7 } : { gte: RANKS[rankIndex + 1].rangeMin, lte: RANKS[rankIndex + 1].rangeMax };
    const candidates = await prisma.challengeMap.findMany({ where: { status: "approved", rating: range }, orderBy: [{ rating: "asc" }, { createdAt: "asc" }], take: 100, select: { id: true, rating: true } });
    const map = candidates.sort((a, b) => Math.abs((a.rating ?? target) - target) - Math.abs((b.rating ?? target) - target))[0];
    if (!map) continue;
    await prisma.$executeRawUnsafe('INSERT INTO "SeasonalPathMap" ("id", "seasonId", "rankIndex", "challengeMapId") VALUES ($1, $2, $3, $4) ON CONFLICT ("seasonId", "rankIndex") DO NOTHING', randomUUID(), seasonId, rankIndex, map.id);
  }
  return prisma.$queryRawUnsafe<Array<{ id: string; rankIndex: number; challengeMapId: string }>>('SELECT "id", "rankIndex", "challengeMapId" FROM "SeasonalPathMap" WHERE "seasonId" = $1 ORDER BY "rankIndex" ASC', seasonId);
}

async function syncUserCompletions(userId: string, seasonId: string, maps: Array<{ id: string; rankIndex: number; challengeMapId: string }>) {
  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId }, select: { profileId: true } });
  if (!profile) return;
  let scores: Awaited<ReturnType<typeof fetchRhythiaScores>>;
  try { scores = await fetchRhythiaScores(profile.profileId); } catch { return; }
  const existing = await prisma.$queryRawUnsafe<Array<{ rankIndex: number }>>('SELECT "rankIndex" FROM "SeasonalPathCompletion" WHERE "seasonId" = $1 AND "userId" = $2', seasonId, userId);
  const completed = new Set(existing.map((entry) => entry.rankIndex));
  for (const pathMap of [...maps].sort((a, b) => a.rankIndex - b.rankIndex)) {
    if (completed.has(pathMap.rankIndex)) continue;
    if (pathMap.rankIndex > 0 && !completed.has(pathMap.rankIndex - 1)) break;
    const map = await prisma.challengeMap.findUnique({ where: { id: pathMap.challengeMapId }, select: { title: true, status: true } });
    if (!map || map.status !== "approved") break;
    const hit = findScoreForMap(scores.recent, map.title) ?? findScoreForMap(scores.top, map.title);
    if (!hit) break;
    await prisma.$executeRawUnsafe('INSERT INTO "SeasonalPathCompletion" ("id", "seasonId", "userId", "rankIndex", "seasonalPathMapId", "scoreId") VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT ("seasonId", "userId", "rankIndex") DO NOTHING', randomUUID(), seasonId, userId, pathMap.rankIndex, pathMap.id, hit.id);
    completed.add(pathMap.rankIndex);
  }
}

export async function getSeasonalPath(userId?: string) {
  await finalizeExpiredSeasons();
  const season = await ensureCurrentSeason();
  const maps = await ensureSeasonMaps(season.id);
  if (userId) await syncUserCompletions(userId, season.id, maps);
  const completions = userId ? await prisma.$queryRawUnsafe<Array<{ rankIndex: number }>>('SELECT "rankIndex" FROM "SeasonalPathCompletion" WHERE "seasonId" = $1 AND "userId" = $2 ORDER BY "rankIndex" ASC', season.id, userId) : [];
  const completedRanks = new Set(completions.map((entry) => entry.rankIndex));
  const completedRank = completions.length ? Math.max(...completions.map((entry) => entry.rankIndex)) : -1;
  const ranks = await Promise.all(RANKS.map(async (rank, index) => {
    const pathMap = maps.find((entry) => entry.rankIndex === index);
    const map = pathMap ? await prisma.challengeMap.findUnique({ where: { id: pathMap.challengeMapId }, select: { id: true, title: true, artist: true, rating: true, imageUrl: true, mapperName: true, length: true, mapFileUrl: true } }) : null;
    return { index, name: rank.name, color: rank.color, map: pathMap ? { ...pathMap, map, completed: completedRanks.has(index), unlocked: index <= completedRank + 1 } : null };
  }));
  return { season, ranks, completedRank };
}

export async function getUserPathRank(userId: string) {
  const path = await getSeasonalPath(userId);
  return path.completedRank;
}
