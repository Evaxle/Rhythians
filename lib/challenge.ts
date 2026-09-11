import { prisma } from "@/lib/db";
import { getAvatarUrl } from "@/lib/avatar";
import { fetchChallengeScores, findChallengeScore, challengeScoreAccuracy } from "@/lib/challenge-score-match";

export const MAX_CHALLENGE_LEVEL = 10;
export function challengeLevelForRating(rating: number): number { return Math.min(MAX_CHALLENGE_LEVEL, Math.max(1, Math.ceil(Math.max(0, rating) / 0.5))); }

export async function ensureChallengeLevelTable() {
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "ChallengeMapLevel" ("id" TEXT NOT NULL, "challengeMapId" TEXT NOT NULL, "level" INTEGER NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ChallengeMapLevel_pkey" PRIMARY KEY ("id"))`);
  await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "ChallengeMapLevel_challengeMapId_key" ON "ChallengeMapLevel"("challengeMapId")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "ChallengeMapLevel_level_idx" ON "ChallengeMapLevel"("level")');
}
async function getAssignedLevels() {
  await ensureChallengeLevelTable();
  return prisma.$queryRawUnsafe<Array<{ challengeMapId: string; level: number }>>('SELECT "challengeMapId","level" FROM "ChallengeMapLevel" WHERE "level" BETWEEN 1 AND 10');
}
export async function getUserChallengeLevel(userId: string): Promise<number> {
  await ensureChallengeLevelTable();

  const override = await prisma.$queryRawUnsafe<Array<{ level: number }>>(
    'SELECT "level" FROM "UserChallengeLevelOverride" WHERE "userId"=$1 LIMIT 1',
    userId,
  ).catch(() => []);
  const baseline = Math.min(MAX_CHALLENGE_LEVEL, Math.max(0, override[0]?.level ?? 0));

  const completed = await prisma.$queryRawUnsafe<Array<{ level: number }>>(
    `SELECT DISTINCT l."level"
     FROM "ChallengeMapLevel" l
     INNER JOIN "ChallengeMapCompletion" c ON c."challengeMapId"=l."challengeMapId"
     WHERE c."userId"=$1
       AND c."passed"=true
       AND l."level" BETWEEN 1 AND 10`,
    userId,
  );

  const passedLevels = new Set(completed.map((row) => row.level));
  let level = baseline;
  for (let next = baseline + 1; next <= MAX_CHALLENGE_LEVEL; next += 1) {
    if (!passedLevels.has(next)) break;
    level = next;
  }
  return level;
}
export async function getChallengeMapsWithCompletions(userId: string) {
  const assignments = await getAssignedLevels();
  if (!assignments.length) return [];
  const assignmentMap = new Map(assignments.map((a) => [a.challengeMapId, a.level]));
  const maps = await prisma.challengeMap.findMany({ where: { id: { in: [...assignmentMap.keys()] }, status: { in: ["approved", "legacy"] } }, orderBy: [{ rating: "asc" }, { createdAt: "asc" }], include: { completions: { where: { userId }, select: { passed: true, accuracy: true } } } });
  return maps.map((map) => ({ id: map.id, title: map.title, artist: map.artist, description: map.description, mapFileUrl: map.mapFileUrl, imageUrl: map.imageUrl, rating: map.rating ?? map.requestedRating ?? 0, mapperName: map.mapperName, noteCount: map.noteCount, length: map.length, level: assignmentMap.get(map.id) ?? 1, completion: map.completions[0] ?? null }));
}
export async function checkAndAwardChallengeLevelMap(userId: string, challengeMapId: string) {
  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId } });
  if (!profile) return { status: "no_profile" as const };
  await ensureChallengeLevelTable();
  const assignment = await prisma.$queryRawUnsafe<Array<{ level: number }>>('SELECT "level" FROM "ChallengeMapLevel" WHERE "challengeMapId"=$1 LIMIT 1', challengeMapId);
  const level = assignment[0]?.level;
  if (!level || level < 1 || level > MAX_CHALLENGE_LEVEL) return { status: "not_available" as const };
  const map = await prisma.challengeMap.findUnique({ where: { id: challengeMapId } });
  if (!map || (map.status !== "approved" && map.status !== "legacy")) return { status: "not_available" as const };
  const currentLevel = await getUserChallengeLevel(userId);
  if (level > currentLevel + 1) return { status: "locked" as const, currentLevel, requiredLevel: currentLevel + 1, level };
  const existing = await prisma.challengeMapCompletion.findUnique({ where: { challengeMapId_userId: { challengeMapId, userId } } });
  if (existing?.passed) return { status: "already" as const, level };
  let scores: Awaited<ReturnType<typeof fetchChallengeScores>>;
  try { scores = await fetchChallengeScores(profile.profileId); } catch { return { status: "not_beat" as const, level }; }
  const hit = findChallengeScore(scores, map.title, map.sourceBeatmapId);
  if (!hit) return { status: "not_beat" as const, level };
  const accuracy = challengeScoreAccuracy(hit);
  await prisma.challengeMapCompletion.upsert({ where: { challengeMapId_userId: { challengeMapId, userId } }, create: { challengeMapId, userId, rating: map.rating ?? map.requestedRating ?? 0, accuracy, passed: true, points: 0, scoreId: hit.id }, update: { accuracy, passed: true, points: 0, scoreId: hit.id } });
  const newLevel = await getUserChallengeLevel(userId);
  return { status: level === currentLevel + 1 && newLevel > currentLevel ? "level_up" as const : "passed" as const, level: newLevel, mapLevel: level, points: 0, earnsRhp: false };
}
export type ChallengeLeaderboardRow = { position: number; userId: string; username: string; displayName: string | null; profileHandle: string; avatarUrl: string | null; level: number; completions: number };
export async function getChallengeLevelLeaderboard(limit = 100): Promise<ChallengeLeaderboardRow[]> {
  const users = await prisma.user.findMany({ where: { rhythiaProfile: { isNot: null } }, select: { id: true, username: true, displayName: true, profileHandle: true, avatar: true, discordId: true } });
  const rows = await Promise.all(users.map(async (user) => ({ userId: user.id, username: user.username, displayName: user.displayName, profileHandle: user.profileHandle, avatarUrl: getAvatarUrl(user), level: await getUserChallengeLevel(user.id), completions: await prisma.challengeMapCompletion.count({ where: { userId: user.id, passed: true } }) })));
  return rows.sort((a, b) => b.level - a.level || b.completions - a.completions).slice(0, limit).map((row, index) => ({ position: index + 1, ...row }));
}
export function challengeLevelLabel(level: number): string { return level >= MAX_CHALLENGE_LEVEL ? `Level ${MAX_CHALLENGE_LEVEL}` : `Level ${level}`; }
