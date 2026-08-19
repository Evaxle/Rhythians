import { prisma } from "@/lib/db";
import { fetchRhythiaScores, findScoreForMap } from "@/lib/daily";
import { accuracyFromMisses, getRankInfo, rhpGainForMap, isMapInRankRange, roundRating } from "@/lib/ranks";

export const MAX_CHALLENGE_LEVEL = 20;

export function challengeLevelForRating(rating: number): number {
  return Math.min(MAX_CHALLENGE_LEVEL, Math.max(1, Math.ceil(Math.max(0, rating) / 0.5)));
}

async function getAssignedLevels() {
  return prisma.$queryRawUnsafe<Array<{ challengeMapId: string; level: number }>>(
    'SELECT "challengeMapId", "level" FROM "ChallengeMapLevel" WHERE "level" BETWEEN 1 AND 20',
  );
}

export async function getUserChallengeLevel(userId: string): Promise<number> {
  const completed = await prisma.$queryRawUnsafe<Array<{ level: number }>>(
    `SELECT DISTINCT l."level"
     FROM "ChallengeMapLevel" l
     INNER JOIN "ChallengeMapCompletion" c ON c."challengeMapId" = l."challengeMapId"
     WHERE c."userId" = $1 AND c."passed" = true AND l."level" BETWEEN 1 AND 20`,
    userId,
  );
  const completedLevels = new Set(completed.map((row) => row.level));
  let level = 0;
  for (let next = 1; next <= MAX_CHALLENGE_LEVEL; next += 1) {
    if (!completedLevels.has(next)) break;
    level = next;
  }
  return level;
}

export async function getChallengeMapsWithCompletions(userId: string) {
  const assignments = await getAssignedLevels();
  if (assignments.length === 0) return [];

  const assignmentMap = new Map(assignments.map((assignment) => [assignment.challengeMapId, assignment.level]));
  const maps = await prisma.challengeMap.findMany({
    where: { id: { in: [...assignmentMap.keys()] }, status: "approved", rating: { not: null } },
    orderBy: [{ rating: "asc" }, { createdAt: "asc" }],
    include: { completions: { where: { userId }, select: { passed: true, accuracy: true } } },
  });

  return maps.map((map) => ({
    id: map.id,
    title: map.title,
    artist: map.artist,
    description: map.description,
    mapFileUrl: map.mapFileUrl,
    imageUrl: map.imageUrl,
    rating: map.rating as number,
    mapperName: map.mapperName,
    noteCount: map.noteCount,
    length: map.length,
    level: assignmentMap.get(map.id) ?? 1,
    completion: map.completions[0] ?? null,
  }));
}

export async function checkAndAwardChallengeLevelMap(userId: string, challengeMapId: string) {
  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId } });
  if (!profile) return { status: "no_profile" as const };

  const assignment = await prisma.$queryRawUnsafe<Array<{ level: number }>>(
    'SELECT "level" FROM "ChallengeMapLevel" WHERE "challengeMapId" = $1 LIMIT 1',
    challengeMapId,
  );
  const level = assignment[0]?.level;
  if (!level || level < 1 || level > MAX_CHALLENGE_LEVEL) return { status: "not_available" as const };

  const map = await prisma.challengeMap.findUnique({ where: { id: challengeMapId } });
  if (!map || map.status !== "approved" || map.rating == null) return { status: "not_available" as const };

  const currentLevel = await getUserChallengeLevel(userId);
  if (level > currentLevel + 1) return { status: "locked" as const, currentLevel, requiredLevel: currentLevel + 1, level };

  const existing = await prisma.challengeMapCompletion.findUnique({ where: { challengeMapId_userId: { challengeMapId, userId } } });
  if (existing?.passed) return { status: "already" as const, level };

  let scores: { recent: import("@/lib/daily").RhythiaScoreEntry[]; top: import("@/lib/daily").RhythiaScoreEntry[] };
  try {
    scores = await fetchRhythiaScores(profile.profileId);
  } catch {
    return { status: "not_beat" as const, level };
  }

  const hit = findScoreForMap(scores.recent, map.title) ?? findScoreForMap(scores.top, map.title);
  if (!hit) return { status: "not_beat" as const, level };

  const accuracy = hit.accuracy ?? accuracyFromMisses(hit.beatmapNotes, hit.misses);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { rhp: true, avgMapRating: true } });
  if (!user) return { status: "not_available" as const };

  const rankInfo = getRankInfo(user.rhp);
  const earnsRhp = isMapInRankRange(map.rating, rankInfo.index);
  const points = earnsRhp ? rhpGainForMap(map.rating, accuracy, hit.speed, rankInfo.index, map.length) : 0;
  const passedCount = await prisma.challengeMapCompletion.count({ where: { userId, passed: true } });
  const newAvg = passedCount === 0 ? roundRating(map.rating) : roundRating(((user.avgMapRating ?? map.rating) * passedCount + map.rating) / (passedCount + 1));

  await prisma.$transaction([
    prisma.challengeMapCompletion.upsert({
      where: { challengeMapId_userId: { challengeMapId, userId } },
      create: { challengeMapId, userId, rating: map.rating, accuracy, passed: true, points, scoreId: hit.id },
      update: { accuracy, passed: true, points, scoreId: hit.id },
    }),
    ...(earnsRhp && points > 0
      ? [
          prisma.user.update({ where: { id: userId }, data: { rhp: user.rhp + points, avgMapRating: newAvg } }),
          prisma.rhpTransaction.create({ data: { userId, amount: points, reason: "challenge_map", description: `Completed ranked map: ${map.title} (${map.rating.toFixed(2)})` } }),
          prisma.notification.create({ data: { userId, type: "rhp_earned", title: "Challenge map completed", message: `You earned ${points} RHP for beating ${map.title} (${map.rating.toFixed(2)} rating).`, url: "/categories?tab=challenge" } }),
        ]
      : []),
  ]);

  const newLevel = await getUserChallengeLevel(userId);
  return { status: level === currentLevel + 1 && newLevel > currentLevel ? "level_up" as const : "passed" as const, level: newLevel, mapLevel: level, points, earnsRhp };
}

export type ChallengeLeaderboardRow = {
  position: number;
  userId: string;
  username: string;
  displayName: string | null;
  profileHandle: string;
  level: number;
  completions: number;
};

export async function getChallengeLevelLeaderboard(limit = 100): Promise<ChallengeLeaderboardRow[]> {
  const users = await prisma.user.findMany({ where: { rhythiaProfile: { isNot: null } }, select: { id: true, username: true, displayName: true, profileHandle: true } });
  const rows = await Promise.all(users.map(async (user) => ({
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    profileHandle: user.profileHandle,
    level: await getUserChallengeLevel(user.id),
    completions: await prisma.challengeMapCompletion.count({ where: { userId: user.id, passed: true } }),
  })));
  return rows.sort((a, b) => b.level - a.level || b.completions - a.completions).slice(0, limit).map((row, index) => ({ position: index + 1, ...row }));
}

export function challengeLevelLabel(level: number): string {
  return level >= MAX_CHALLENGE_LEVEL ? `Level ${MAX_CHALLENGE_LEVEL}` : `Level ${level}`;
}
