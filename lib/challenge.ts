import { prisma } from "@/lib/db";
import { fetchRhythiaScores, findScoreForMap } from "@/lib/daily";
import { accuracyFromMisses } from "@/lib/ranks";
import { getAvatarUrl } from "@/lib/avatar";

export const MAX_CHALLENGE_LEVEL = 10;

export function challengeLevelForRating(rating: number): number {
  return Math.min(MAX_CHALLENGE_LEVEL, Math.max(1, Math.ceil(Math.max(0, rating) / 0.5)));
}

export async function ensureChallengeLevelTable() {
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "ChallengeMapLevel" ("id" TEXT NOT NULL, "challengeMapId" TEXT NOT NULL, "level" INTEGER NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ChallengeMapLevel_pkey" PRIMARY KEY ("id"))`);
  await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "ChallengeMapLevel_challengeMapId_key" ON "ChallengeMapLevel"("challengeMapId")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "ChallengeMapLevel_level_idx" ON "ChallengeMapLevel"("level")');
}

export async function ensureChallengeVisibilityTable() {
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "ChallengeMapVisibility" ("challengeMapId" TEXT NOT NULL, "visible" BOOLEAN NOT NULL DEFAULT true, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ChallengeMapVisibility_pkey" PRIMARY KEY ("challengeMapId"), CONSTRAINT "ChallengeMapVisibility_challengeMapId_fkey" FOREIGN KEY ("challengeMapId") REFERENCES "ChallengeMap"("id") ON DELETE CASCADE)`);
}

async function getAssignedLevels() {
  await ensureChallengeLevelTable();
  return prisma.$queryRawUnsafe<Array<{ challengeMapId: string; level: number }>>('SELECT "challengeMapId", "level" FROM "ChallengeMapLevel" WHERE "level" BETWEEN 1 AND 10');
}

async function getVisibleMapIds(ids: string[]) {
  if (ids.length === 0) return new Set<string>();
  await ensureChallengeVisibilityTable();
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT m."id" FROM "ChallengeMap" m LEFT JOIN "ChallengeMapVisibility" v ON v."challengeMapId" = m."id" WHERE m."id" = ANY($1::text[]) AND COALESCE(v."visible", true) = true`, ids);
  return new Set(rows.map((row) => row.id));
}

export async function getUserChallengeLevel(userId: string): Promise<number> {
  const override = await prisma.$queryRawUnsafe<Array<{ level: number }>>('SELECT "level" FROM "UserChallengeLevelOverride" WHERE "userId" = $1 LIMIT 1', userId).catch(() => []);
  if (override[0]) return Math.min(MAX_CHALLENGE_LEVEL, Math.max(0, override[0].level));
  await ensureChallengeLevelTable();
  const completed = await prisma.$queryRawUnsafe<Array<{ level: number }>>(`SELECT DISTINCT l."level" FROM "ChallengeMapLevel" l INNER JOIN "ChallengeMapCompletion" c ON c."challengeMapId" = l."challengeMapId" WHERE c."userId" = $1 AND c."passed" = true AND l."level" BETWEEN 1 AND 10`, userId);
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
  const visibleIds = await getVisibleMapIds([...assignmentMap.keys()]);
  const maps = await prisma.challengeMap.findMany({ where: { id: { in: [...visibleIds] }, status: "approved", rating: { not: null }, isAutoImported: false }, orderBy: [{ rating: "asc" }, { createdAt: "asc" }], include: { completions: { where: { userId }, select: { passed: true, accuracy: true } } } });
  return maps.map((map) => ({ id: map.id, title: map.title, artist: map.artist, description: map.description, mapFileUrl: map.mapFileUrl, imageUrl: map.imageUrl, rating: map.rating as number, mapperName: map.mapperName, noteCount: map.noteCount, length: map.length, level: assignmentMap.get(map.id) ?? 1, completion: map.completions[0] ?? null }));
}

export async function checkAndAwardChallengeLevelMap(userId: string, challengeMapId: string) {
  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId } });
  if (!profile) return { status: "no_profile" as const };
  await ensureChallengeLevelTable();
  const assignment = await prisma.$queryRawUnsafe<Array<{ level: number }>>('SELECT "level" FROM "ChallengeMapLevel" WHERE "challengeMapId" = $1 LIMIT 1', challengeMapId);
  const level = assignment[0]?.level;
  if (!level || level < 1 || level > MAX_CHALLENGE_LEVEL) return { status: "not_available" as const };
  const visibleIds = await getVisibleMapIds([challengeMapId]);
  if (!visibleIds.has(challengeMapId)) return { status: "not_available" as const };
  const map = await prisma.challengeMap.findUnique({ where: { id: challengeMapId } });
  if (!map || map.isAutoImported || map.status !== "approved") return { status: "not_available" as const };
  const currentLevel = await getUserChallengeLevel(userId);
  if (level > currentLevel + 1) return { status: "locked" as const, currentLevel, requiredLevel: currentLevel + 1, level };
  const existing = await prisma.challengeMapCompletion.findUnique({ where: { challengeMapId_userId: { challengeMapId, userId } } });
  if (existing?.passed) return { status: "already" as const, level };
  let scores: { recent: import("@/lib/daily").RhythiaScoreEntry[]; top: import("@/lib/daily").RhythiaScoreEntry[] };
  try { scores = await fetchRhythiaScores(profile.profileId); } catch { return { status: "not_beat" as const, level }; }
  const hit = findScoreForMap(scores.recent, map.title) ?? findScoreForMap(scores.top, map.title);
  if (!hit) return { status: "not_beat" as const, level };
  const accuracy = hit.accuracy ?? accuracyFromMisses(hit.beatmapNotes, hit.misses);
  await prisma.challengeMapCompletion.upsert({ where: { challengeMapId_userId: { challengeMapId, userId } }, create: { challengeMapId, userId, rating: map.rating ?? 0, accuracy, passed: true, points: 0, scoreId: hit.id }, update: { accuracy, passed: true, points: 0, scoreId: hit.id } });
  const newLevel = await getUserChallengeLevel(userId);
  return { status: level === currentLevel + 1 && newLevel > currentLevel ? "level_up" as const : "passed" as const, level: newLevel, mapLevel: level, points: 0, earnsRhp: false };
}

export async function checkChallengeLevel(userId: string, level: number) {
  if (!Number.isInteger(level) || level < 1 || level > 6) throw new Error("Automatic level checking is only available for Levels 1-6.");
  const currentLevel = await getUserChallengeLevel(userId);
  if (level > currentLevel + 1) throw new Error(`Level ${level} is locked.`);
  const maps = await getChallengeMapsWithCompletions(userId);
  const targets = maps.filter((map) => map.level === level);
  let passed = 0;
  let already = 0;
  let notBeat = 0;
  for (const map of targets) {
    const result = await checkAndAwardChallengeLevelMap(userId, map.id);
    if (result.status === "passed" || result.status === "level_up") passed += 1;
    else if (result.status === "already") already += 1;
    else if (result.status === "not_beat") notBeat += 1;
  }
  return { checked: targets.length, passed, already, notBeat, level: await getUserChallengeLevel(userId) };
}

export type ChallengeLeaderboardRow = { position: number; userId: string; username: string; displayName: string | null; profileHandle: string; avatarUrl: string | null; level: number; completions: number };

export async function getChallengeLevelLeaderboard(limit = 100): Promise<ChallengeLeaderboardRow[]> {
  const users = await prisma.user.findMany({ where: { rhythiaProfile: { isNot: null } }, select: { id: true, username: true, displayName: true, profileHandle: true, avatar: true, discordId: true } });
  const rows = await Promise.all(users.map(async (user) => ({ userId: user.id, username: user.username, displayName: user.displayName, profileHandle: user.profileHandle, avatarUrl: getAvatarUrl(user), level: await getUserChallengeLevel(user.id), completions: await prisma.challengeMapCompletion.count({ where: { userId: user.id, passed: true } }) })));
  return rows.sort((a, b) => b.level - a.level || b.completions - a.completions).slice(0, limit).map((row, index) => ({ position: index + 1, ...row }));
}

export function challengeLevelLabel(level: number): string {
  return level >= MAX_CHALLENGE_LEVEL ? `Level ${MAX_CHALLENGE_LEVEL}` : `Level ${level}`;
}
