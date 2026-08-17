import { prisma } from "@/lib/db";
import { fetchRhythiaScores, findScoreForMap } from "@/lib/daily";
import {
  RANKS,
  getRankInfo,
  isMapInRankRange,
  roundRating,
  rhpGainForMap,
  rhpLossForMap,
  accuracyFromMisses,
  type RankInfo,
} from "@/lib/ranks";

function normalizeTitle(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function matchesTitle(scoreTitle: string | null | undefined, mapTitle: string): boolean {
  const target = normalizeTitle(mapTitle);
  return target.length > 0 && normalizeTitle(scoreTitle) === target;
}

export async function submitChallengeMap(data: {
  title: string;
  artist: string | null;
  description: string | null;
  mapFileUrl: string;
  imageUrl: string | null;
  requestedRating: number;
  mapperName: string | null;
  noteCount: number | null;
  length: number | null;
  submittedById: string;
  sourceBeatmapId?: number | null;
  sourceUrl?: string | null;
  isAutoImported?: boolean;
}) {
  const rating = roundRating(Math.min(9.99, Math.max(0, data.requestedRating)));
  return prisma.challengeMap.create({
    data: {
      title: data.title.trim(),
      artist: data.artist?.trim() || null,
      description: data.description?.trim() || null,
      mapFileUrl: data.mapFileUrl,
      imageUrl: data.imageUrl,
      requestedRating: rating,
      mapperName: data.mapperName?.trim() || null,
      noteCount: data.noteCount,
      length: data.length,
      submittedById: data.submittedById,
      sourceBeatmapId: data.sourceBeatmapId ?? null,
      sourceUrl: data.sourceUrl ?? null,
      isAutoImported: data.isAutoImported ?? false,
    },
  });
}

export async function getPendingChallengeMaps() {
  return prisma.challengeMap.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    include: { submittedBy: { select: { username: true, displayName: true, profileHandle: true } } },
  });
}

export async function reviewChallengeMap(mapId: string, reviewerId: string, status: "approved" | "rejected", finalRating: number | null, note: string | null) {
  const map = await prisma.challengeMap.findUnique({ where: { id: mapId } });
  if (!map) throw new Error("Map not found.");
  if (map.status !== "pending") throw new Error("This map has already been reviewed.");

  const rating = status === "approved" ? roundRating(finalRating ?? map.requestedRating) : null;

  const updated = await prisma.challengeMap.update({
    where: { id: mapId },
    data: {
      status,
      rating,
      reviewerNote: note?.trim() || null,
      reviewedById: reviewerId,
      reviewedAt: new Date(),
    },
  });

  await prisma.notification.create({
    data: {
      userId: map.submittedById,
      type: status === "approved" ? "map_approved" : "map_rejected",
      title: status === "approved" ? "Your map was approved" : "Your map was rejected",
      message:
        status === "approved"
          ? `"${map.title}" was approved and is now playable with a rating of ${rating?.toFixed(2)}.`
          : `"${map.title}" was rejected.${note?.trim() ? `\n\nReason: ${note.trim()}` : ""}`,
      url: "/maps",
    },
  });

  return updated;
}

export type ChallengeMapCheckResult =
  | { status: "no_profile"; points: number }
  | { status: "not_available"; points: number }
  | { status: "out_of_range"; points: number; rankInfo: RankInfo }
  | { status: "error"; points: number }
  | { status: "already"; points: number }
  | { status: "beat"; points: number; rankInfo: RankInfo; accuracy: number | null }
  | { status: "failed"; points: number; rankInfo: RankInfo }
  | { status: "not_beat"; points: number };

export async function checkAndAwardChallengeMap(userId: string, challengeMapId: string): Promise<ChallengeMapCheckResult> {
  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId } });
  if (!profile) return { status: "no_profile", points: 0 };

  const map = await prisma.challengeMap.findUnique({ where: { id: challengeMapId } });
  if (!map || map.status !== "approved" || map.rating == null) {
    return { status: "not_available", points: 0 };
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { rhp: true, avgMapRating: true } });
  if (!user) return { status: "not_available", points: 0 };

  const rankInfo = getRankInfo(user.rhp);
  if (!isMapInRankRange(map.rating, rankInfo.index)) {
    return { status: "out_of_range", points: 0, rankInfo };
  }

  let scores: { recent: import("@/lib/daily").RhythiaScoreEntry[]; top: import("@/lib/daily").RhythiaScoreEntry[] };
  try {
    scores = await fetchRhythiaScores(profile.profileId);
  } catch {
    return { status: "error", points: 0 };
  }

  const allScores = [...scores.recent, ...scores.top];
  const passHit = findScoreForMap(scores.recent, map.title) ?? findScoreForMap(scores.top, map.title);

  const existing = await prisma.challengeMapCompletion.findUnique({
    where: { challengeMapId_userId: { challengeMapId: map.id, userId } },
  });
  if (existing?.passed) return { status: "already", points: existing.points };

  const accuracy = passHit
    ? passHit.accuracy ?? accuracyFromMisses(passHit.beatmapNotes, passHit.misses)
    : null;

  if (passHit) {
    const points = rhpGainForMap(map.rating, accuracy);
    const newRhp = user.rhp + points;
    const newRankInfo = getRankInfo(newRhp);

    const passedCount = await prisma.challengeMapCompletion.count({ where: { userId, passed: true } });
    const newAvg = passedCount === 0
      ? map.rating
      : roundRating(((user.avgMapRating ?? map.rating) * passedCount + map.rating) / (passedCount + 1));

    await prisma.$transaction([
      prisma.challengeMapCompletion.upsert({
        where: { challengeMapId_userId: { challengeMapId: map.id, userId } },
        create: { challengeMapId: map.id, userId, rating: map.rating, accuracy, passed: true, points, scoreId: passHit.id },
        update: { accuracy, passed: true, points, scoreId: passHit.id },
      }),
      prisma.user.update({ where: { id: userId }, data: { rhp: newRhp, avgMapRating: newAvg } }),
      prisma.rhpTransaction.create({
        data: {
          userId,
          amount: points,
          reason: "challenge_map",
          description: `Completed ranked map: ${map.title} (${map.rating.toFixed(2)})`,
        },
      }),
      prisma.notification.create({
        data: {
          userId,
          type: "rhp_earned",
          title: "Map completed",
          message: `You earned ${points} RHP for beating ${map.title} (${map.rating.toFixed(2)} rating).`,
          url: "/maps",
        },
      }),
    ]);

    if (newRankInfo.index > rankInfo.index) {
      await prisma.notification.create({
        data: {
          userId,
          type: "rank_change",
          title: "Rank up!",
          message: `You reached ${newRankInfo.name} ${newRankInfo.isUnnamed ? "" : newRankInfo.tier}!`,
          url: "/leaderboards",
        },
      });
    }

    return { status: "beat", points, rankInfo: newRankInfo, accuracy };
  }

  const failHit = allScores.find((score) => !score.passed && matchesTitle(score.beatmapTitle, map.title));
  if (failHit && !existing) {
    const loss = -rhpLossForMap(map.rating);
    const newRhp = Math.max(0, user.rhp + loss);
    await prisma.$transaction([
      prisma.challengeMapCompletion.create({
        data: { challengeMapId: map.id, userId, rating: map.rating, accuracy, passed: false, points: loss, scoreId: failHit.id },
      }),
      prisma.user.update({ where: { id: userId }, data: { rhp: newRhp } }),
      prisma.rhpTransaction.create({
        data: { userId, amount: loss, reason: "challenge_map", description: `Attempted ranked map: ${map.title}` },
      }),
    ]);
    return { status: "failed", points: loss, rankInfo: getRankInfo(newRhp) };
  }

  return { status: "not_beat", points: 0 };
}

export async function getUserGlobalRank(userId: string): Promise<number | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { rhp: true } });
  if (!user) return null;
  const higher = await prisma.user.count({ where: { rhp: { gt: user.rhp } } });
  return higher + 1;
}

export async function getChallengeLeaderboard(rankIndex: number, limit = 100) {
  const rank = RANKS[rankIndex];
  const minRhp = rank.minRhp;
  const maxRhp = rankIndex < RANKS.length - 1 ? RANKS[rankIndex + 1].minRhp : null;

  const users = await prisma.user.findMany({
    where: {
      rhp: maxRhp == null ? { gte: minRhp } : { gte: minRhp, lt: maxRhp },
      NOT: { profileHandle: "rhythia-imports" },
    },
    select: { id: true, username: true, displayName: true, profileHandle: true, avatar: true, rhp: true, avgMapRating: true },
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
    include: { submittedBy: { select: { username: true, displayName: true, profileHandle: true } } },
  });

  const user = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { rhp: true } }) : null;
  const rankInfo = user ? getRankInfo(user.rhp) : null;

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
      completion: stateMap.get(map.id) ?? null,
    })),
  };
}