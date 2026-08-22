import { prisma } from "@/lib/db";
import { fetchAllRhythiaScores, fetchRankedMaps } from "@/lib/daily";
import { RANKS, getRankInfo, isMapInRankRange, rankIndexForRating, fairRatingFromStars, type RankInfo } from "@/lib/ranks";

function normalizeTitle(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

async function restoreAutoImportedMaps() {
  const existing = await prisma.challengeMap.count({ where: { isAutoImported: true } });
  if (existing > 0) return existing;

  const importer = await prisma.user.findFirst({ where: { profileHandle: "rhythia-imports" }, select: { id: true } });
  if (!importer) return 0;

  const ranked = await fetchRankedMaps();
  const data = ranked
    .filter((map) => map.id > 0 && map.downloadUrl)
    .map((map) => {
      const separator = map.title.indexOf(" - ");
      const artist = separator > 0 ? map.title.slice(0, separator).trim() : null;
      const rating = fairRatingFromStars(map.starRating ?? 0);
      return {
        title: map.title,
        artist,
        description: null,
        mapFileUrl: map.downloadUrl ?? `https://www.rhythia.com/maps/${map.id}`,
        imageUrl: map.imageUrl,
        requestedRating: rating,
        rating,
        mapperName: map.ownerUsername,
        noteCount: map.noteCount,
        length: map.length,
        submittedById: importer.id,
        status: "approved" as const,
        reviewedById: importer.id,
        reviewedAt: new Date(),
        sourceBeatmapId: map.id,
        sourceUrl: `https://www.rhythia.com/maps/${map.id}`,
        isAutoImported: true,
      };
    });

  if (data.length === 0) return 0;
  await prisma.challengeMap.createMany({ data, skipDuplicates: true });
  return data.length;
}

export async function getUserGlobalRank(userId: string): Promise<number | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { rhp: true } });
  if (!user) return null;
  return (await prisma.user.count({ where: { rhp: { gt: user.rhp } } })) + 1;
}

export async function checkAllRankedMaps(userId: string) {
  await restoreAutoImportedMaps();
  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId }, select: { profileId: true } });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { rhp: true } });
  if (!profile || !user) return { checked: 0, foundScores: 0, alreadyCompleted: 0, newlyCompleted: 0, totalPoints: 0 };

  const rankInfo = getRankInfo(user.rhp);
  const maps = await prisma.challengeMap.findMany({
    where: { status: "approved", rating: { not: null, gte: rankInfo.rangeMin, lte: rankInfo.rangeMax }, isAutoImported: true },
    select: { id: true, title: true, rating: true, length: true },
  });
  const scores = await fetchAllRhythiaScores(profile.profileId);
  const scoreTitles = new Set(scores.map((score) => normalizeTitle(score.beatmapTitle)).filter(Boolean));
  let foundScores = 0;
  for (const map of maps) if (scoreTitles.has(normalizeTitle(map.title))) foundScores += 1;

  return { checked: maps.length, foundScores, alreadyCompleted: 0, newlyCompleted: 0, totalPoints: 0, rankIndex: rankInfo.index };
}

export async function getChallengeLeaderboard(rankIndex: number, limit = 100) {
  const rank = RANKS[rankIndex];
  if (!rank) return [];
  const minRhp = rank.minRhp;
  const maxRhp = rankIndex < RANKS.length - 1 ? RANKS[rankIndex + 1].minRhp : null;
  const users = await prisma.user.findMany({
    where: { rhp: maxRhp == null ? { gte: minRhp } : { gte: minRhp, lt: maxRhp }, NOT: { profileHandle: "rhythia-imports" } },
    select: { id: true, username: true, displayName: true, profileHandle: true, avatar: true, rhp: true, avgMapRating: true },
    orderBy: { rhp: "desc" },
    take: limit,
  });
  const completionCounts = await prisma.challengeMapCompletion.groupBy({ by: ["userId"], where: { userId: { in: users.map((user) => user.id) }, passed: true }, _count: { _all: true } });
  const countMap = new Map(completionCounts.map((entry) => [entry.userId, entry._count._all]));
  return users.map((user, index) => ({ position: index + 1, userId: user.id, username: user.username, displayName: user.displayName, profileHandle: user.profileHandle, avatar: user.avatar, rhp: user.rhp, avgMapRating: user.avgMapRating, completions: countMap.get(user.id) ?? 0, rankInfo: getRankInfo(user.rhp) }));
}

export async function getApprovedMaps(includeAll: boolean, userId: string | null, includeUnranked = false) {
  await restoreAutoImportedMaps();
  const maps = await prisma.challengeMap.findMany({
    where: includeUnranked ? { status: { in: ["approved", "pending"] }, rating: { not: null } } : { status: "approved", rating: { not: null } },
    orderBy: [{ rating: "asc" }, { createdAt: "desc" }],
    include: { submittedBy: { select: { username: true, displayName: true, profileHandle: true, avatar: true } }, reviewedBy: { select: { username: true, displayName: true, profileHandle: true, avatar: true } } },
  });
  const legacyMaps = await prisma.$queryRawUnsafe<Array<{ id: string; title: string; artist: string | null; description: string | null; mapFileUrl: string; imageUrl: string | null; rating: number | null; mapperName: string | null; noteCount: number | null; length: number | null; isAutoImported: boolean; submittedUsername: string; submittedDisplayName: string | null; submittedProfileHandle: string; submittedAvatar: string | null; reviewedUsername: string | null; reviewedDisplayName: string | null; reviewedProfileHandle: string | null; reviewedAvatar: string | null }>>('SELECT c."id", c."title", c."artist", c."description", c."mapFileUrl", c."imageUrl", c."rating", c."mapperName", c."noteCount", c."length", c."isAutoImported", s."username" AS "submittedUsername", s."displayName" AS "submittedDisplayName", s."profileHandle" AS "submittedProfileHandle", s."avatar" AS "submittedAvatar", r."username" AS "reviewedUsername", r."displayName" AS "reviewedDisplayName", r."profileHandle" AS "reviewedProfileHandle", r."avatar" AS "reviewedAvatar" FROM "ChallengeMap" c JOIN "User" s ON s."id" = c."submittedById" LEFT JOIN "User" r ON r."id" = c."reviewedById" WHERE c."status" = \'legacy\' AND c."rating" IS NOT NULL ORDER BY c."rating" ASC, c."createdAt" DESC');
  const user = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { id: true, rhp: true } }) : null;
  const rankInfo: RankInfo | null = user ? getRankInfo(user.rhp) : null;
  const visible = includeAll || !rankInfo ? maps : maps.filter((map) => map.status !== "approved" || isMapInRankRange(map.rating ?? 0, rankInfo.index));
  const allVisibleMaps = [...visible, ...legacyMaps];
  const completionIds = allVisibleMaps.map((map) => map.id);
  const completionState = userId && completionIds.length > 0 ? await prisma.challengeMapCompletion.findMany({ where: { userId, challengeMapId: { in: completionIds } }, select: { challengeMapId: true, passed: true, points: true } }) : [];
  const stateMap = new Map(completionState.map((entry) => [entry.challengeMapId, entry]));

  let scoredTitles = new Set<string>();
  if (user?.id) {
    try {
      const profile = await prisma.rhythiaProfile.findUnique({ where: { userId: user.id }, select: { profileId: true } });
      if (profile) {
        const scores = await fetchAllRhythiaScores(profile.profileId);
        scoredTitles = new Set(scores.filter((score) => score.passed).map((score) => normalizeTitle(score.beatmapTitle)).filter(Boolean));
      }
    } catch {
      scoredTitles = new Set<string>();
    }
  }

  return {
    rankInfo,
    maps: allVisibleMaps.map((map) => {
      const isLegacy = "submittedUsername" in map;
      const isRanked = !isLegacy && map.status === "approved";
      const mapRankIndex = rankIndexForRating(map.rating ?? 0);
      const submittedBy = isLegacy ? { username: map.submittedUsername, displayName: map.submittedDisplayName, profileHandle: map.submittedProfileHandle, avatar: map.submittedAvatar } : map.submittedBy;
      const reviewedBy = isLegacy ? { username: map.reviewedUsername, displayName: map.reviewedDisplayName, profileHandle: map.reviewedProfileHandle, avatar: map.reviewedAvatar } : map.reviewedBy;
      return {
        id: map.id,
        title: map.title,
        artist: map.artist,
        description: map.description,
        mapFileUrl: map.mapFileUrl,
        imageUrl: map.imageUrl,
        rating: map.rating,
        rankIndex: mapRankIndex,
        rankName: isLegacy ? "Legacy" : isRanked ? RANKS[mapRankIndex]?.name ?? "Expert" : "Unranked",
        rankColor: isLegacy ? "#a78bfa" : isRanked ? RANKS[mapRankIndex]?.color ?? RANKS[RANKS.length - 1].color : "#f59e0b",
        mapperName: map.mapperName,
        noteCount: map.noteCount,
        length: map.length,
        submittedBy,
        reviewedBy,
        completion: stateMap.get(map.id) ?? null,
        hasScore: scoredTitles.has(normalizeTitle(map.title)),
        isAutoImported: map.isAutoImported,
        isRanked,
        isLegacy,
      };
    }),
  };
}

export async function getMapLeaderboard(mapId: string) {
  const map = await prisma.challengeMap.findUnique({ where: { id: mapId }, select: { id: true, title: true, rating: true, status: true, isAutoImported: true } });
  if (!map || map.isAutoImported || map.status !== "approved" || map.rating == null) return null;
  const rankIndex = rankIndexForRating(map.rating);
  const rank = RANKS[rankIndex] ?? RANKS[0];
  const completions = await prisma.challengeMapCompletion.findMany({ where: { challengeMapId: mapId, passed: true }, include: { user: { select: { id: true, username: true, displayName: true, profileHandle: true, avatar: true, rhp: true } } } });
  const rows = completions
    .filter((entry) => getRankInfo(entry.user.rhp).index === rankIndex)
    .sort((a, b) => (b.accuracy ?? -1) - (a.accuracy ?? -1) || b.points - a.points)
    .slice(0, 100)
    .map((entry, index) => ({ position: index + 1, userId: entry.user.id, username: entry.user.username, displayName: entry.user.displayName, profileHandle: entry.user.profileHandle, avatar: entry.user.avatar, accuracy: entry.accuracy, points: entry.points, rankInfo: getRankInfo(entry.user.rhp) }));
  return { mapId: map.id, title: map.title, rating: map.rating, rankIndex, rankName: rank.name === "Expert" ? "Expert" : rank.name, rankColor: rank.color, rangeMin: rank.rangeMin, rangeMax: rank.rangeMax, rows };
}

export async function resetUserRankedStatus(userId: string) {
  return prisma.$transaction([
    prisma.challengeMapCompletion.deleteMany({ where: { userId } }),
    prisma.rhpTransaction.deleteMany({ where: { userId } }),
    prisma.user.update({ where: { id: userId }, data: { rhp: 0, avgMapRating: null, scoreImportDone: false } }),
  ]);
}
