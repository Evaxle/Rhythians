import { prisma } from "@/lib/db";
import { fetchRhythiaScores, findScoreForMap, getOrCreateDailyMap, startOfDayUTC } from "@/lib/daily";
import { RANKS, fairRatingFromStars, getRankInfo, rhpGainForMap } from "@/lib/ranks";

export async function checkAndAwardDailyAcrossRankChange(userId: string) {
  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId } });
  if (!profile) return { status: "no_profile", points: 0, streak: 0 } as const;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { rhp: true, dailyStreak: true, lastDailyBeatAt: true } });
  if (!user) return { status: "no_profile", points: 0, streak: 0 } as const;

  const today = startOfDayUTC();
  const existingToday = await prisma.dailyMapBeat.findFirst({ where: { userId, createdAt: { gte: today } }, orderBy: { createdAt: "desc" } });
  if (existingToday) return { status: "already", points: existingToday.points, streak: user.dailyStreak } as const;

  const rankInfo = getRankInfo(user.rhp);
  const currentDaily = await getOrCreateDailyMap(rankInfo.index, today);
  const dailyMaps = await prisma.dailyMap.findMany({ where: { date: today }, orderBy: { rankIndex: "asc" } });

  let scores;
  try {
    scores = await fetchRhythiaScores(profile.profileId);
  } catch {
    return { status: "not_beat", points: 0, streak: user.dailyStreak } as const;
  }

  const allScores = [...scores.recent, ...scores.top];
  const candidates = dailyMaps.length > 0 ? dailyMaps : [currentDaily];
  const daily = candidates.find((map) => findScoreForMap(allScores, map.title)) ?? null;
  if (!daily) return { status: "not_beat", points: 0, streak: user.dailyStreak } as const;

  const hit = findScoreForMap(allScores, daily.title);
  if (!hit) return { status: "not_beat", points: 0, streak: user.dailyStreak } as const;

  const rating = fairRatingFromStars(daily.starRating);
  const points = rhpGainForMap(rating, hit.accuracy ?? null, hit.speed, daily.rankIndex, daily.length != null ? daily.length / 1000 : null);
  const now = new Date();
  const yesterday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1));
  const lastBeatDay = user.lastDailyBeatAt ? startOfDayUTC(user.lastDailyBeatAt) : null;
  const newStreak = lastBeatDay?.getTime() === yesterday.getTime() ? user.dailyStreak + 1 : 1;

  try {
    await prisma.$transaction([
      prisma.dailyMapBeat.create({ data: { dailyMapId: daily.id, userId, points, scoreId: hit.id, accuracy: hit.accuracy ?? null, misses: hit.misses } }),
      prisma.user.update({ where: { id: userId }, data: { rhp: { increment: points }, dailyStreak: newStreak, lastDailyBeatAt: now } }),
      prisma.rhpTransaction.create({ data: { userId, amount: points, reason: "daily_map", description: `Beaten daily map: ${daily.title}` } }),
      prisma.notification.create({ data: { userId, type: "rhp_earned", title: "Daily map beaten", message: `You earned ${points} RHP for beating today's daily map: ${daily.title}. Streak: ${newStreak} day${newStreak === 1 ? "" : "s"}.`, url: "/daily" } }),
    ]);
  } catch {
    const beat = await prisma.dailyMapBeat.findFirst({ where: { userId, createdAt: { gte: today } }, orderBy: { createdAt: "desc" } });
    if (beat) return { status: "already", points: beat.points, streak: user.dailyStreak } as const;
    throw new Error("Unable to record the daily map completion.");
  }

  return { status: "beat", points, streak: newStreak, dailyMapId: daily.id, rankIndex: daily.rankIndex } as const;
}

export async function getUserDailyStatusAcrossRankChange(userId: string) {
  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { rhp: true, dailyStreak: true, lastDailyBeatAt: true } });
  if (!user) return null;

  const rankInfo = getRankInfo(user.rhp);
  const daily = await getOrCreateDailyMap(rankInfo.index);
  const today = startOfDayUTC();
  const beatToday = await prisma.dailyMapBeat.findFirst({ where: { userId, createdAt: { gte: today } }, orderBy: { createdAt: "desc" }, select: { points: true, createdAt: true, accuracy: true, misses: true, scoreId: true, dailyMapId: true } });
  const currentBeat = beatToday?.dailyMapId === daily.id ? beatToday : null;
  const warning = Boolean(beatToday && !currentBeat);

  const yesterday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1));
  const lastBeatDay = user.lastDailyBeatAt ? startOfDayUTC(user.lastDailyBeatAt) : null;
  const effectiveStreak = lastBeatDay && (lastBeatDay.getTime() === today.getTime() || lastBeatDay.getTime() === yesterday.getTime()) ? user.dailyStreak : 0;

  return {
    dailyMapId: daily.id,
    rankIndex: rankInfo.index,
    rankName: rankInfo.name,
    streak: effectiveStreak,
    alreadyBeatToday: Boolean(beatToday),
    beatFromPreviousRank: warning,
    beat: currentBeat ? { points: currentBeat.points, createdAt: currentBeat.createdAt, accuracy: currentBeat.accuracy, misses: currentBeat.misses, scoreId: currentBeat.scoreId } : null,
  };
}

export function rankRangeLabel(rankIndex: number) {
  const rank = RANKS[rankIndex] ?? RANKS[RANKS.length - 1];
  return `${rank.rangeMin.toFixed(2)}–${rank.rangeMax.toFixed(2)}`;
}
