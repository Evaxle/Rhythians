import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { CATEGORIES, CATEGORY_LABELS, MAX_CATEGORY_LEVEL, getUserCategoryLevels } from "@/lib/categories";
import { MAX_CHALLENGE_LEVEL, ensureChallengeLevelTable, getUserChallengeLevel } from "@/lib/challenge";
import { fetchChallengeScores, findChallengeScore, challengeScoreAccuracy } from "@/lib/challenge-score-match";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId: user.id } });
  if (!profile) return NextResponse.json({ error: "Link your Rhythia profile first." }, { status: 400 });
  const body = await request.json().catch(() => null) as { scope?: string } | null;
  const challengeOnly = body?.scope === "challenge";
  let scores: Awaited<ReturnType<typeof fetchChallengeScores>>;
  try { scores = await fetchChallengeScores(profile.profileId); } catch { return NextResponse.json({ error: "Rhythia scores could not be loaded right now." }, { status: 502 }); }

  await ensureChallengeLevelTable();
  const challengeBefore = await getUserChallengeLevel(user.id);
  const challengeTarget = challengeBefore < MAX_CHALLENGE_LEVEL ? challengeBefore + 1 : null;
  let challengeChecked = 0;
  let challengePasses = 0;

  if (challengeTarget != null) {
    const maps = await prisma.$queryRawUnsafe<Array<{ id: string; title: string; rating: number | null; requestedRating: number; sourceBeatmapId: number | null }>>(`SELECT m."id",m."title",m."rating",m."requestedRating",m."sourceBeatmapId" FROM "ChallengeMap" m JOIN "ChallengeMapLevel" l ON l."challengeMapId"=m."id" WHERE m."status" IN ('approved','legacy') AND l."level"=$1 ORDER BY m."rating" ASC NULLS LAST, m."createdAt" ASC`, challengeTarget);
    challengeChecked = maps.length;
    for (const map of maps) {
      const hit = findChallengeScore(scores, map.title, map.sourceBeatmapId);
      if (!hit) continue;
      const accuracy = challengeScoreAccuracy(hit);
      await prisma.challengeMapCompletion.upsert({
        where: { challengeMapId_userId: { challengeMapId: map.id, userId: user.id } },
        create: { challengeMapId: map.id, userId: user.id, rating: map.rating ?? map.requestedRating ?? 0, accuracy, passed: true, points: 0, scoreId: hit.id },
        update: { rating: map.rating ?? map.requestedRating ?? 0, accuracy, passed: true, points: 0, scoreId: hit.id },
      });
      challengePasses += 1;
    }
  }

  const challengeAfter = await getUserChallengeLevel(user.id);
  if (challengeOnly) {
    return NextResponse.json({
      challenge: { levelBefore: challengeBefore, targetLevel: challengeTarget, levelAfter: challengeAfter, checked: challengeChecked, passes: challengePasses },
      categories: [],
      note: "Only the currently eligible regular Challenge level was scanned across ranked, unranked, and legacy maps.",
    });
  }

  const categoryBeforeRows = await getUserCategoryLevels(user.id);
  const categoryBefore = new Map(categoryBeforeRows.map((entry) => [entry.category, entry.level]));
  const categories = [];
  for (const category of CATEGORIES) {
    const before = Number(categoryBefore.get(category) ?? 0);
    const target = before < MAX_CATEGORY_LEVEL ? before + 1 : null;
    let checked = 0;
    let passes = 0;
    if (target != null) {
      const maps = await prisma.categoryMap.findMany({ where: { category, level: target, status: "approved" }, select: { id: true, title: true, sourceBeatmapId: true } });
      checked = maps.length;
      for (const map of maps) {
        const hit = findChallengeScore(scores, map.title, map.sourceBeatmapId);
        if (!hit) continue;
        await prisma.categoryMapCompletion.upsert({ where: { categoryMapId_userId: { categoryMapId: map.id, userId: user.id } }, create: { categoryMapId: map.id, userId: user.id, passed: true, accuracy: challengeScoreAccuracy(hit), scoreId: hit.id }, update: { passed: true, accuracy: challengeScoreAccuracy(hit), scoreId: hit.id } });
        passes += 1;
      }
      if (passes > 0) await prisma.userCategoryLevel.upsert({ where: { userId_category: { userId: user.id, category } }, create: { userId: user.id, category, level: target }, update: { level: target } });
    }
    categories.push({ category, label: CATEGORY_LABELS[category], levelBefore: before, targetLevel: target, levelAfter: passes > 0 && target != null ? target : before, checked, passes });
  }

  return NextResponse.json({ challenge: { levelBefore: challengeBefore, targetLevel: challengeTarget, levelAfter: challengeAfter, checked: challengeChecked, passes: challengePasses }, categories, note: "Only the level that was eligible when this check started was scanned. Ranked, unranked, and legacy source maps can all count toward Challenge/category progression." });
}
