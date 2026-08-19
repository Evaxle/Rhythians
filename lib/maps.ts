import { prisma } from "@/lib/db";
import { fetchAllRhythiaScores, bestScoreByTitle, normalizeTitle } from "@/lib/daily";
import { accuracyFromMisses, getRankInfo, rhpGainForMap, RANKS, roundRating } from "@/lib/ranks";

export async function getChallengeMapsForRank(rankIndex: number) {
  const rank = RANKS[rankIndex] ?? RANKS[RANKS.length - 1];
  return prisma.challengeMap.findMany({
    where: { status: "approved", rating: { gte: rank.rangeMin, lte: rank.rangeMax } },
    orderBy: [{ rating: "asc" }, { createdAt: "desc" }],
    include: { submittedBy: { select: { username: true, displayName: true, profileHandle: true, avatar: true } } },
  });
}

export async function checkAndAwardAllChallengeMaps(userId: string) {
  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId } });
  if (!profile) return { checked: 0, awarded: 0, rankIndex: null };

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { rhp: true } });
  if (!user) return { checked: 0, awarded: 0, rankIndex: null };

  const rankInfo = getRankInfo(user.rhp);
  const maps = await prisma.challengeMap.findMany({
    where: { status: "approved", rating: { gte: rankInfo.rangeMin, lte: rankInfo.rangeMax } },
    orderBy: [{ rating: "asc" }, { createdAt: "asc" }],
  });

  const scores = await fetchAllRhythiaScores(profile.profileId);
  const bestScores = bestScoreByTitle(scores);
  let checked = 0;
  let awarded = 0;

  for (const map of maps) {
    checked += 1;
    if (map.rating == null) continue;

    const existing = await prisma.challengeMapCompletion.findUnique({ where: { challengeMapId_userId: { challengeMapId: map.id, userId } } });
    if (existing?.passed) continue;

    const score = bestScores.get(normalizeTitle(map.title));
    if (!score) continue;

    const accuracy = score.accuracy ?? accuracyFromMisses(score.beatmapNotes, score.misses);
    const points = rhpGainForMap(map.rating, accuracy, score.speed, rankInfo.index, map.length);
    const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { rhp: true, avgMapRating: true } });
    if (!currentUser) continue;
    const newRhp = currentUser.rhp + points;
    const passedCount = await prisma.challengeMapCompletion.count({ where: { userId, passed: true } });
    const newAvg = passedCount === 0 ? map.rating : roundRating(((currentUser.avgMapRating ?? map.rating) * passedCount + map.rating) / (passedCount + 1));

    await prisma.$transaction([
      prisma.challengeMapCompletion.upsert({
        where: { challengeMapId_userId: { challengeMapId: map.id, userId } },
        create: { challengeMapId: map.id, userId, rating: map.rating, accuracy, passed: true, points, scoreId: score.id },
        update: { accuracy, passed: true, points, scoreId: score.id },
      }),
      prisma.user.update({ where: { id: userId }, data: { rhp: newRhp, avgMapRating: newAvg, scoreImportDone: true } }),
      prisma.rhpTransaction.create({
        data: {
          userId,
          amount: points,
          reason: "challenge_map",
          description: `Imported completed ranked map: ${map.title} (${map.rating.toFixed(2)})`,
        },
      }),
    ]);
    awarded += points;
  }

  await prisma.user.update({ where: { id: userId }, data: { scoreImportDone: true } });
  return { checked, awarded, rankIndex: rankInfo.index };
}
