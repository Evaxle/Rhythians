import { prisma } from "@/lib/db";
import { fetchAllRhythiaScores, fetchRhythiaScores, findScoreForMap, type RhythiaScoreEntry } from "@/lib/daily";
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

export function bestScoreByTitle(scores: RhythiaScoreEntry[]): Map<string, RhythiaScoreEntry> {
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
    include: { submittedBy: { select: { username: true, displayName: true, profileHandle: true, avatar: true } } },
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
  if (existing?.passed) {
    if (passHit) {
      const newAccuracy = passHit.accuracy ?? accuracyFromMisses(passHit.beatmapNotes, passHit.misses);
      if (newAccuracy != null && (existing.accuracy == null || newAccuracy > existing.accuracy)) {
        await prisma.challengeMapCompletion.update({
          where: { id: existing.id },
          data: { accuracy: newAccuracy },
        });
      }
    }
    return { status: "already", points: existing.points };
  }

  const accuracy = passHit
    ? passHit.accuracy ?? accuracyFromMisses(passHit.beatmapNotes, passHit.misses)
    : null;

  if (passHit) {
    const points = rhpGainForMap(map.rating, accuracy, passHit.speed, rankInfo.index);
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
          message: `You reached ${newRankInfo.name} ${newRankInfo.isExpert ? "" : newRankInfo.tier}!`,
          url: "/leaderboards",
        },
      });
    }

    return { status: "beat", points, rankInfo: newRankInfo, accuracy };
  }

  const failHit = allScores.find((score) => !score.passed && matchesTitle(score.beatmapTitle, map.title));
  if (failHit && !existing) {
    const failAccuracy = failHit.accuracy ?? accuracyFromMisses(failHit.beatmapNotes, failHit.misses);
    const passers = await prisma.challengeMapCompletion.findMany({
      where: { challengeMapId: map.id, passed: true },
      select: { accuracy: true },
    });
    const totalBeaters = passers.length;
    const yourPlace =
      failAccuracy == null
        ? totalBeaters + 1
        : 1 + passers.filter((entry) => entry.accuracy != null && entry.accuracy > failAccuracy).length;
    const loss = -rhpLossForMap(map.rating, { totalBeaters, yourPlace });
    const newRhp = Math.max(0, user.rhp + loss);
    await prisma.$transaction([
      prisma.challengeMapCompletion.create({
        data: { challengeMapId: map.id, userId, rating: map.rating, accuracy: failAccuracy, passed: false, points: loss, scoreId: failHit.id },
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
  const higher = await prisma.user.count({
    where: { rhp: { gt: user.rhp }, rhythiaVerified: true },
  });
  return higher + 1;
}

export async function getChallengeLeaderboard(rankIndex: number, limit = 100) {
  const rank = RANKS[rankIndex];
  const minRhp = rank.minRhp;
  const maxRhp = rankIndex < RANKS.length - 1 ? RANKS[rankIndex + 1].minRhp : null;

  const users = await prisma.user.findMany({
    where: {
      rhp: maxRhp == null ? { gte: minRhp } : { gte: minRhp, lt: maxRhp },
      rhythiaVerified: true,
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
    include: {
      submittedBy: { select: { username: true, displayName: true, profileHandle: true } },
      reviewedBy: { select: { username: true, displayName: true, profileHandle: true } },
    },
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
      reviewedBy: map.reviewedBy,
      completion: stateMap.get(map.id) ?? null,
    })),
  };
}

export type MapLeaderboardEntry = {
  position: number;
  userId: string;
  username: string;
  displayName: string | null;
  profileHandle: string;
  avatar: string | null;
  discordId: string | null;
  accuracy: number | null;
  points: number;
  rhp: number;
  rankInfo: RankInfo;
};

export type MapLeaderboardResult = {
  mapId: string;
  title: string;
  rating: number;
  rankIndex: number;
  rankName: string;
  rankColor: string;
  rankMinRating: number;
  rankMaxRating: number;
  entries: MapLeaderboardEntry[];
  viewer: { position: number; accuracy: number | null; points: number } | null;
  viewerRemoved: boolean;
};

export function rankIndexForRating(rating: number): number {
  const index = RANKS.findIndex((rank) => rating >= rank.rangeMin && rating <= rank.rangeMax);
  return index >= 0 ? index : RANKS.length - 1;
}

export async function getMapLeaderboard(mapId: string, viewerUserId?: string | null): Promise<MapLeaderboardResult | null> {
  const map = await prisma.challengeMap.findUnique({ where: { id: mapId } });
  if (!map || map.status !== "approved" || map.rating == null) return null;

  const rankIndex = rankIndexForRating(map.rating);
  const rank = RANKS[rankIndex];

  const completions = await prisma.challengeMapCompletion.findMany({
    where: { challengeMapId: mapId, passed: true },
    select: { userId: true, accuracy: true, points: true },
  });

  const users = await prisma.user.findMany({
    where: { id: { in: completions.map((entry) => entry.userId) }, NOT: { profileHandle: "rhythia-imports" } },
    select: { id: true, username: true, displayName: true, profileHandle: true, avatar: true, discordId: true, rhp: true },
  });
  const userMap = new Map(users.map((entry) => [entry.id, entry]));

  const rows = completions
    .map((completion) => {
      const user = userMap.get(completion.userId);
      if (!user) return null;
      if (!isMapInRankRange(map.rating as number, getRankInfo(user.rhp).index)) return null;
      return { ...completion, user };
    })
    .filter((row): row is NonNullable<typeof row> => row != null)
    .sort((a, b) => (b.accuracy ?? -1) - (a.accuracy ?? -1) || b.points - a.points);

  const entries: MapLeaderboardEntry[] = rows.slice(0, 10).map((row, index) => ({
    position: index + 1,
    userId: row.userId,
    username: row.user.username,
    displayName: row.user.displayName,
    profileHandle: row.user.profileHandle,
    avatar: row.user.avatar,
    discordId: row.user.discordId,
    accuracy: row.accuracy,
    points: row.points,
    rhp: row.user.rhp,
    rankInfo: getRankInfo(row.user.rhp),
  }));

  let viewer: MapLeaderboardResult["viewer"] = null;
  let viewerRemoved = false;
  if (viewerUserId) {
    const viewerIndex = rows.findIndex((row) => row.userId === viewerUserId);
    if (viewerIndex >= 0) {
      const completion = completions.find((entry) => entry.userId === viewerUserId);
      viewer = { position: viewerIndex + 1, accuracy: completion?.accuracy ?? null, points: completion?.points ?? 0 };
    } else if (completions.some((entry) => entry.userId === viewerUserId)) {
      viewerRemoved = true;
    }
  }

  return {
    mapId,
    title: map.title,
    rating: map.rating,
    rankIndex,
    rankName: rank.name,
    rankColor: rank.color,
    rankMinRating: rank.rangeMin,
    rankMaxRating: rank.rangeMax,
    entries,
    viewer,
    viewerRemoved,
  };
}

export type CheckAllResult = {
  checked: number;
  newlyCompleted: number;
  totalPoints: number;
  alreadyCompleted: number;
  failed: number;
  errors: number;
};

// Fetches the user's full Rhythia score history (top scores, recent plays, and
// VR plays) once and awards RHP for every ranked map they have a passing score
// for, regardless of their current rank's rating range. Easier maps are
// processed first while the user's rank is lowest so harder maps naturally earn
// the lower RHP their rank should give.
export async function checkAndAwardAllChallengeMaps(userId: string): Promise<CheckAllResult> {
  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("Link your Rhythia account to check your scores.");

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { rhp: true, avgMapRating: true } });
  if (!user) throw new Error("User not found.");

  const maps = await prisma.challengeMap.findMany({
    where: { status: "approved", rating: { not: null } },
    orderBy: [{ rating: "asc" }, { createdAt: "desc" }],
  });

  let scores: RhythiaScoreEntry[];
  try {
    scores = await fetchAllRhythiaScores(profile.profileId);
  } catch {
    throw new Error("Unable to fetch your scores from Rhythia. Try again later.");
  }
  const bestScores = bestScoreByTitle(scores);

  const existing = await prisma.challengeMapCompletion.findMany({
    where: { userId, challengeMapId: { in: maps.map((map) => map.id) } },
    select: { id: true, challengeMapId: true, passed: true, accuracy: true },
  });
  const existingMap = new Map(existing.map((entry) => [entry.challengeMapId, entry]));

  const result: CheckAllResult = { checked: maps.length, newlyCompleted: 0, totalPoints: 0, alreadyCompleted: 0, failed: 0, errors: 0 };

  const initialRankIndex = getRankInfo(user.rhp).index;
  let rhp = user.rhp;
  let rankInfo = getRankInfo(rhp);
  let avgMapRating = user.avgMapRating;
  let passedCount = await prisma.challengeMapCompletion.count({ where: { userId, passed: true } });

  const completionsToUpsert: Array<{
    challengeMapId: string;
    rating: number;
    accuracy: number | null;
    passed: boolean;
    points: number;
    scoreId: number | null;
  }> = [];
  const rhpTransactions: Array<{ amount: number; description: string }> = [];
  const notifications: Array<{ type: "rhp_earned"; title: string; message: string }> = [];

  for (const map of maps) {
    const rating = map.rating as number;
    const prior = existingMap.get(map.id);
    if (prior?.passed) {
      const score = bestScores.get(normalizeTitle(map.title));
      if (score) {
        const newAccuracy = score.accuracy ?? accuracyFromMisses(score.beatmapNotes, score.misses);
        if (newAccuracy != null && (prior.accuracy == null || newAccuracy > prior.accuracy)) {
          await prisma.challengeMapCompletion.update({
            where: { id: prior.id },
            data: { accuracy: newAccuracy },
          });
        }
      }
      result.alreadyCompleted += 1;
      continue;
    }

    const score = bestScores.get(normalizeTitle(map.title));
    if (!score) continue;

    const accuracy = score.accuracy ?? accuracyFromMisses(score.beatmapNotes, score.misses);
    const points = rhpGainForMap(rating, accuracy, score.speed, rankInfo.index);
    rhp += points;
    passedCount += 1;
    avgMapRating = passedCount === 0
      ? rating
      : roundRating(((avgMapRating ?? rating) * (passedCount - 1) + rating) / passedCount);
    rankInfo = getRankInfo(rhp);

    completionsToUpsert.push({
      challengeMapId: map.id,
      rating,
      accuracy,
      passed: true,
      points,
      scoreId: score.id,
    });
    rhpTransactions.push({ amount: points, description: `Imported historical completion: ${map.title} (${rating.toFixed(2)})` });
    notifications.push({
      type: "rhp_earned",
      title: "Historical map completed",
      message: `You earned ${points} RHP for previously beating ${map.title} (${rating.toFixed(2)} rating).`,
    });
    result.newlyCompleted += 1;
    result.totalPoints += points;
  }

  const newRhp = Math.max(0, rhp);
  const newRankInfo = getRankInfo(newRhp);

  await prisma.$transaction([
    ...completionsToUpsert.map((entry) =>
      prisma.challengeMapCompletion.upsert({
        where: { challengeMapId_userId: { challengeMapId: entry.challengeMapId, userId } },
        create: { ...entry, userId },
        update: {
          accuracy: entry.accuracy,
          passed: entry.passed,
          points: entry.points,
          scoreId: entry.scoreId,
        },
      })
    ),
    prisma.user.update({
      where: { id: userId },
      data: { rhp: newRhp, avgMapRating: roundRating(avgMapRating ?? user.avgMapRating ?? 0), scoreImportDone: true },
    }),
    ...rhpTransactions.map((transaction) =>
      prisma.rhpTransaction.create({
        data: { userId, amount: transaction.amount, reason: "score_import", description: transaction.description },
      })
    ),
    ...notifications.map((notification) =>
      prisma.notification.create({
        data: { userId, type: notification.type, title: notification.title, message: notification.message, url: "/maps" },
      })
    ),
  ]);

  if (newRankInfo.index > initialRankIndex) {
    await prisma.notification.create({
      data: {
        userId,
        type: "rank_change",
        title: "Rank up!",
        message: `You reached ${newRankInfo.name} ${newRankInfo.isExpert ? "" : newRankInfo.tier}!`,
        url: "/leaderboards",
      },
    });
  }

  return result;
}