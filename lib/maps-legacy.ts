import { prisma } from "@/lib/db";
import { RANKS, getRankInfo, isMapInRankRange, type RankInfo } from "@/lib/ranks";

export async function getUserGlobalRank(userId: string): Promise<number | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { rhp: true } });
  if (!user) return null;
  const higher = await prisma.user.count({ where: { rhp: { gt: user.rhp } } });
  return higher + 1;
}

export async function getChallengeLeaderboard(rankIndex: number, limit = 100) {
  const rank = RANKS[rankIndex];
  if (!rank) return [];

  const minRhp = rank.minRhp;
  const maxRhp = rankIndex < RANKS.length - 1 ? RANKS[rankIndex + 1].minRhp : null;

  const users = await prisma.user.findMany({
    where: {
      rhp: maxRhp == null ? { gte: minRhp } : { gte: minRhp, lt: maxRhp },
      NOT: { profileHandle: "rhythia-imports" },
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      profileHandle: true,
      avatar: true,
      rhp: true,
      avgMapRating: true,
    },
    orderBy: { rhp: "desc" },
    take: limit,
  });

  const completionCounts = await prisma.challengeMapCompletion.groupBy({
    by: ["userId"],
    where: { userId: { in: users.map((user) => user.id) }, passed: true },
    _count: { _all: true },
  });
  const countMap = new Map(completionCounts.map((entry) => [entry.userId, entry._count._all]));

  return users.map((user, index) => ({
    position: index + 1,
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    profileHandle: user.profileHandle,
    avatar: user.avatar,
    rhp: user.rhp,
    avgMapRating: user.avgMapRating,
    completions: countMap.get(user.id) ?? 0,
    rankInfo: getRankInfo(user.rhp),
  }));
}

export async function getApprovedMaps(includeAll: boolean, userId: string | null) {
  const maps = await prisma.challengeMap.findMany({
    where: { status: "approved", rating: { not: null } },
    orderBy: [{ rating: "asc" }, { createdAt: "desc" }],
    include: {
      submittedBy: { select: { username: true, displayName: true, profileHandle: true, avatar: true } },
      reviewedBy: { select: { username: true, displayName: true, profileHandle: true, avatar: true } },
    },
  });

  const user = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { rhp: true } }) : null;
  const rankInfo: RankInfo | null = user ? getRankInfo(user.rhp) : null;
  const visible = includeAll || !rankInfo ? maps : maps.filter((map) => isMapInRankRange(map.rating ?? 0, rankInfo.index));

  const completionState = userId
    ? await prisma.challengeMapCompletion.findMany({
        where: { userId, challengeMapId: { in: visible.map((map) => map.id) } },
        select: { challengeMapId: true, passed: true, points: true },
      })
    : [];
  const stateMap = new Map(completionState.map((entry) => [entry.challengeMapId, entry]));

  return {
    rankInfo,
    maps: visible.map((map) => ({
      id: map.id,
      title: map.title,
      artist: map.artist,
      description: map.description,
      mapFileUrl: map.mapFileUrl,
      imageUrl: map.imageUrl,
      rating: map.rating,
      mapperName: map.mapperName,
      noteCount: map.noteCount,
      length: map.length,
      submittedBy: map.submittedBy,
      reviewedBy: map.reviewedBy,
      completion: stateMap.get(map.id) ?? null,
    })),
  };
}

export async function resetUserRankedStatus(userId: string) {
  return prisma.$transaction([
    prisma.challengeMapCompletion.deleteMany({ where: { userId } }),
    prisma.rhpTransaction.deleteMany({ where: { userId } }),
    prisma.user.update({
      where: { id: userId },
      data: {
        rhp: 0,
        avgMapRating: null,
        scoreImportDone: false,
      },
    }),
  ]);
}
