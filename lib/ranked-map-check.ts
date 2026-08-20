import { prisma } from "@/lib/db";
import { fetchAllRhythiaScores, type RhythiaScoreEntry } from "@/lib/daily";
import { accuracyFromMisses, getRankInfo, isMapInRankRange, rhpGainForMap } from "@/lib/ranks";
import { upsertRankedMapScore } from "@/lib/ranked-map-leaderboard";

function normalizeTitle(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function bestScoresByTitle(scores: RhythiaScoreEntry[]) {
  const best = new Map<string, RhythiaScoreEntry>();
  for (const score of scores) {
    if (!score.passed) continue;
    const title = normalizeTitle(score.beatmapTitle);
    if (!title) continue;
    const existing = best.get(title);
    if (!existing || (score.awarded_sp ?? 0) > (existing.awarded_sp ?? 0)) best.set(title, score);
  }
  return best;
}

async function alreadyAwarded(userId: string, mapId: string) {
  return Boolean(await prisma.rhpTransaction.findFirst({
    where: { userId, reason: "ranked_map", description: { startsWith: `Completed ranked map [${mapId}]:` } },
    select: { id: true },
  }));
}

function scoreDetails(map: { rating: number; length: number | null }, score: RhythiaScoreEntry, rankIndex: number) {
  const accuracy = score.accuracy ?? accuracyFromMisses(score.beatmapNotes, score.misses);
  const points = rhpGainForMap(map.rating, accuracy, score.speed, rankIndex, map.length != null ? map.length / 1000 : null);
  return { accuracy, points };
}

export async function checkRankedMap(userId: string, mapId: string) {
  const [profile, user] = await Promise.all([
    prisma.rhythiaProfile.findUnique({ where: { userId }, select: { profileId: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { rhp: true } }),
  ]);
  if (!profile || !user) return { status: "not_available" as const, points: 0 };

  const map = await prisma.challengeMap.findUnique({ where: { id: mapId }, select: { id: true, title: true, rating: true, length: true, status: true } });
  if (!map || map.status !== "approved" || map.rating == null) return { status: "not_available" as const, points: 0 };

  const rankInfo = getRankInfo(user.rhp);
  if (!isMapInRankRange(map.rating, rankInfo.index)) return { status: "out_of_range" as const, points: 0, rankInfo };

  let scores: RhythiaScoreEntry[];
  try { scores = await fetchAllRhythiaScores(profile.profileId); } catch { return { status: "error" as const, points: 0 }; }

  const score = bestScoresByTitle(scores).get(normalizeTitle(map.title));
  if (!score) return { status: "not_beat" as const, points: 0, rankInfo };

  const { accuracy, points } = scoreDetails({ rating: map.rating, length: map.length }, score, rankInfo.index);
  await upsertRankedMapScore(map.id, userId, { rating: map.rating, accuracy, passed: true, points, scoreId: score.id ?? null, speed: score.speed ?? null, rankIndex: rankInfo.index });

  if (await alreadyAwarded(userId, map.id)) return { status: "already" as const, points: 0, accuracy, rankInfo: getRankInfo(user.rhp) };

  const updatedUser = await prisma.user.findUnique({ where: { id: userId }, select: { rhp: true } });
  if (!updatedUser) return { status: "not_available" as const, points: 0 };

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { rhp: updatedUser.rhp + points } }),
    prisma.rhpTransaction.create({ data: { userId, amount: points, reason: "ranked_map", description: `Completed ranked map [${map.id}]: ${map.title} (${map.rating.toFixed(2)})` } }),
  ]);

  return { status: "beat" as const, points, accuracy, rankInfo: getRankInfo(updatedUser.rhp + points) };
}

export async function checkAllRankedMaps(userId: string) {
  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId }, select: { profileId: true } });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { rhp: true } });
  if (!profile || !user) return { checked: 0, foundScores: 0, alreadyCompleted: 0, newlyCompleted: 0, totalPoints: 0 };

  const rankInfo = getRankInfo(user.rhp);
  const maps = await prisma.challengeMap.findMany({ where: { status: "approved", rating: { not: null, gte: rankInfo.rangeMin, lte: rankInfo.rangeMax } }, select: { id: true, title: true, rating: true, length: true } });
  let scores: RhythiaScoreEntry[];
  try { scores = await fetchAllRhythiaScores(profile.profileId); } catch { return { checked: maps.length, foundScores: 0, alreadyCompleted: 0, newlyCompleted: 0, totalPoints: 0, rankIndex: rankInfo.index }; }

  const bestScores = bestScoresByTitle(scores);
  let foundScores = 0;
  let alreadyCompleted = 0;
  let newlyCompleted = 0;
  let totalPoints = 0;

  for (const map of maps) {
    if (map.rating == null || !isMapInRankRange(map.rating, rankInfo.index)) continue;
    const score = bestScores.get(normalizeTitle(map.title));
    if (!score) continue;
    foundScores += 1;
    const { accuracy, points } = scoreDetails({ rating: map.rating, length: map.length }, score, rankInfo.index);
    await upsertRankedMapScore(map.id, userId, { rating: map.rating, accuracy, passed: true, points, scoreId: score.id ?? null, speed: score.speed ?? null, rankIndex: rankInfo.index });
    if (await alreadyAwarded(userId, map.id)) { alreadyCompleted += 1; continue; }
    const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { rhp: true } });
    if (!currentUser) continue;
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { rhp: currentUser.rhp + points } }),
      prisma.rhpTransaction.create({ data: { userId, amount: points, reason: "ranked_map", description: `Completed ranked map [${map.id}]: ${map.title} (${map.rating.toFixed(2)})` } }),
    ]);
    newlyCompleted += 1;
    totalPoints += points;
  }

  return { checked: maps.length, foundScores, alreadyCompleted, newlyCompleted, totalPoints, rankIndex: rankInfo.index };
}
