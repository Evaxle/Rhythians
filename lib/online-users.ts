import { prisma } from "@/lib/db";
import { ensureChallengeLevelTable, MAX_CHALLENGE_LEVEL } from "@/lib/challenge";

export async function getOnlineGlobalRankedUsers() {
  const users = await prisma.user.findMany({
    where: { rhythiaProfile: { is: { isOnline: true } } },
    select: {
      id: true,
      username: true,
      displayName: true,
      profileHandle: true,
      avatar: true,
      rhp: true,
      rhythiaProfile: { select: { title: true, isOnline: true } },
    },
    orderBy: [{ rhp: "desc" }, { username: "asc" }],
  });

  const allRankedUsers = await prisma.user.findMany({
    where: { rhythiaProfile: { isNot: null } },
    select: { id: true },
    orderBy: [{ rhp: "desc" }, { username: "asc" }],
  });
  const globalPositions = new Map(allRankedUsers.map((user, index) => [user.id, index + 1]));
  const userIds = users.map((user) => user.id);
  const challengeLevels = new Map<string, number>();

  if (userIds.length > 0) {
    await ensureChallengeLevelTable();
    const overrides = await prisma.$queryRawUnsafe<Array<{ userId: string; level: number }>>(
      'SELECT "userId", "level" FROM "UserChallengeLevelOverride" WHERE "userId" = ANY($1::text[])',
      userIds,
    ).catch(() => []);
    const overridden = new Set<string>();
    for (const row of overrides) {
      challengeLevels.set(row.userId, Math.min(MAX_CHALLENGE_LEVEL, Math.max(0, row.level)));
      overridden.add(row.userId);
    }
    const completed = await prisma.$queryRawUnsafe<Array<{ userId: string; level: number }>>(
      `SELECT c."userId", l."level"
       FROM "ChallengeMapLevel" l
       INNER JOIN "ChallengeMapCompletion" c ON c."challengeMapId" = l."challengeMapId"
       WHERE c."userId" = ANY($1::text[]) AND c."passed" = true AND l."level" BETWEEN 1 AND $2
       GROUP BY c."userId", l."level"
       ORDER BY c."userId", l."level"`,
      userIds,
      MAX_CHALLENGE_LEVEL,
    );
    const levelsByUser = new Map<string, Set<number>>();
    for (const row of completed) {
      if (overridden.has(row.userId)) continue;
      const levels = levelsByUser.get(row.userId) ?? new Set<number>();
      levels.add(row.level);
      levelsByUser.set(row.userId, levels);
    }
    for (const userId of userIds) {
      if (overridden.has(userId)) continue;
      const levels = levelsByUser.get(userId) ?? new Set<number>();
      let current = 0;
      for (let level = 1; level <= MAX_CHALLENGE_LEVEL; level += 1) {
        if (!levels.has(level)) break;
        current = level;
      }
      challengeLevels.set(userId, current);
    }
  }

  return users.map((user) => ({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    profileHandle: user.profileHandle,
    avatar: user.avatar,
    title: user.rhythiaProfile?.title ?? "Rhythian",
    rhp: user.rhp,
    globalPosition: globalPositions.get(user.id) ?? null,
    challengeLevel: challengeLevels.get(user.id) ?? 0,
  }));
}
