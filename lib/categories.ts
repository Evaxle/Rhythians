import { prisma } from "@/lib/db";
import { fetchRhythiaScores, findScoreForMap } from "@/lib/daily";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  MAX_CATEGORY_LEVEL,
  isCategory,
  type Category,
} from "@/lib/category-constants";

export { CATEGORIES, CATEGORY_LABELS, MAX_CATEGORY_LEVEL, isCategory };
export type { Category };

// A user's current level in every category. Everyone starts at level 0.
export async function getUserCategoryLevels(userId: string): Promise<Array<{ category: Category; level: number }>> {
  const rows = await prisma.userCategoryLevel.findMany({ where: { userId } });
  const levelMap = new Map(rows.map((row) => [row.category, row.level]));
  return CATEGORIES.map((category) => ({ category, level: levelMap.get(category) ?? 0 }));
}

export async function getUserCategoryLevel(userId: string, category: Category): Promise<number> {
  const row = await prisma.userCategoryLevel.findUnique({
    where: { userId_category: { userId, category } },
  });
  return row?.level ?? 0;
}

// All approved maps in a category, optionally filtered to a single level.
export async function getCategoryMaps(category: Category, level?: number) {
  return prisma.categoryMap.findMany({
    where: { category, status: "approved", ...(level != null ? { level } : {}) },
    orderBy: [{ level: "asc" }, { createdAt: "asc" }],
  });
}

export type CategoryMapWithCompletion = Awaited<ReturnType<typeof getCategoryMaps>>[number] & {
  completion: { passed: boolean; accuracy: number | null } | null;
};

export type SerializedCategoryMap = {
  id: string;
  category: Category;
  level: number;
  title: string;
  artist: string | null;
  description: string | null;
  mapFileUrl: string;
  imageUrl: string | null;
  mapperName: string | null;
  noteCount: number | null;
  length: number | null;
  completion: { passed: boolean; accuracy: number | null } | null;
};

// Client components can't receive Prisma Date objects — pick only plain fields.
export function serializeCategoryMapForClient(map: CategoryMapWithCompletion): SerializedCategoryMap {
  return {
    id: map.id,
    category: map.category,
    level: map.level,
    title: map.title,
    artist: map.artist,
    description: map.description,
    mapFileUrl: map.mapFileUrl,
    imageUrl: map.imageUrl,
    mapperName: map.mapperName,
    noteCount: map.noteCount,
    length: map.length,
    completion: map.completion,
  };
}

// All approved maps in a category with the user's completion state for each.
export async function getCategoryMapsWithCompletions(userId: string, category: Category): Promise<CategoryMapWithCompletion[]> {
  const maps = await getCategoryMaps(category);
  const completions = await prisma.categoryMapCompletion.findMany({
    where: { userId, categoryMap: { category } },
    select: { categoryMapId: true, passed: true, accuracy: true },
  });
  const completionMap = new Map(completions.map((completion) => [completion.categoryMapId, completion]));
  return maps.map((map) => ({ ...map, completion: completionMap.get(map.id) ?? null }));
}

export type CategoryCheckResult =
  | { status: "no_profile" }
  | { status: "not_available" }
  | { status: "locked"; currentLevel: number; requiredLevel: number }
  | { status: "already" }
  | { status: "not_beat" }
  | { status: "level_up"; level: number; accuracy: number | null }
  | { status: "passed"; accuracy: number | null };

// Checks a category map against the user's Rhythia scores and levels them up if
// they passed it. Levels must be earned in order: you can only progress by
// passing a map at exactly your current level + 1. Passing a higher-level map
// does nothing until you've earned the prerequisite levels.
export async function checkAndAwardCategoryMap(userId: string, categoryMapId: string): Promise<CategoryCheckResult> {
  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId } });
  if (!profile) return { status: "no_profile" };

  const map = await prisma.categoryMap.findUnique({ where: { id: categoryMapId } });
  if (!map || map.status !== "approved") return { status: "not_available" };

  const currentLevel = await getUserCategoryLevel(userId, map.category);

  // Can't skip levels: only the next level counts for progression.
  if (map.level > currentLevel + 1) {
    return { status: "locked", currentLevel, requiredLevel: currentLevel + 1 };
  }

  const existing = await prisma.categoryMapCompletion.findUnique({
    where: { categoryMapId_userId: { categoryMapId: map.id, userId } },
  });
  if (existing?.passed) return { status: "already" };

  let scores: { recent: import("@/lib/daily").RhythiaScoreEntry[]; top: import("@/lib/daily").RhythiaScoreEntry[] };
  try {
    scores = await fetchRhythiaScores(profile.profileId);
  } catch {
    return { status: "not_beat" };
  }

  const hit = findScoreForMap(scores.recent, map.title) ?? findScoreForMap(scores.top, map.title);
  if (!hit) return { status: "not_beat" };

  const accuracy = hit.accuracy ?? null;
  const levelsUp = map.level === currentLevel + 1;

  await prisma.$transaction([
    prisma.categoryMapCompletion.upsert({
      where: { categoryMapId_userId: { categoryMapId: map.id, userId } },
      create: { categoryMapId: map.id, userId, passed: true, accuracy, scoreId: hit.id },
      update: { passed: true, accuracy, scoreId: hit.id },
    }),
    ...(levelsUp
      ? [
          prisma.userCategoryLevel.upsert({
            where: { userId_category: { userId, category: map.category } },
            create: { userId, category: map.category, level: map.level },
            update: { level: map.level },
          }),
        ]
      : []),
    prisma.notification.create({
      data: {
        userId,
        type: "rhp_earned",
        title: levelsUp ? `${CATEGORY_LABELS[map.category]} level up!` : `${CATEGORY_LABELS[map.category]} map completed`,
        message: levelsUp
          ? `You reached ${CATEGORY_LABELS[map.category]} level ${map.level} by beating ${map.title}.`
          : `You beat ${map.title} (${CATEGORY_LABELS[map.category]} level ${map.level}).`,
        url: "/categories",
      },
    }),
  ]);

  return levelsUp
    ? { status: "level_up", level: map.level, accuracy }
    : { status: "passed", accuracy };
}

export type CategoryLeaderboardRow = {
  position: number;
  userId: string;
  username: string;
  displayName: string | null;
  profileHandle: string;
  avatar: string | null;
  level: number;
  completions: number;
};

// Leaderboard for a category, ranked by level (highest first), then by number
// of maps completed in the category.
export async function getCategoryLeaderboard(category: Category, limit = 100): Promise<CategoryLeaderboardRow[]> {
  const levels = await prisma.userCategoryLevel.findMany({
    where: { category },
    include: {
      user: { select: { id: true, username: true, displayName: true, profileHandle: true, avatar: true } },
    },
  });

  const completionCounts = await prisma.categoryMapCompletion.groupBy({
    by: ["userId"],
    where: { passed: true, categoryMap: { category } },
    _count: { _all: true },
  });
  const countMap = new Map(completionCounts.map((entry) => [entry.userId, entry._count._all]));

  return levels
    .map((row) => ({
      userId: row.user.id,
      username: row.user.username,
      displayName: row.user.displayName,
      profileHandle: row.user.profileHandle,
      avatar: row.user.avatar,
      level: row.level,
      completions: countMap.get(row.user.id) ?? 0,
    }))
    .sort((a, b) => b.level - a.level || b.completions - a.completions)
    .slice(0, limit)
    .map((row, index) => ({ position: index + 1, ...row }));
}

export type CategoryStats = {
  category: Category;
  label: string;
  level: number;
  completions: number;
  mapsAtNextLevel: number;
  mapsCompletedAtNextLevel: number;
};

// Per-category stats for a user: current level, total completions, and how many
// maps exist / are completed at their next level.
export async function getCategoryStats(userId: string): Promise<CategoryStats[]> {
  const levels = await getUserCategoryLevels(userId);
  const levelMap = new Map(levels.map((entry) => [entry.category, entry.level]));

  const completions = await prisma.categoryMapCompletion.findMany({
    where: { userId, passed: true },
    include: { categoryMap: { select: { category: true, level: true } } },
  });

  const completionCounts = new Map<Category, number>();
  for (const completion of completions) {
    completionCounts.set(completion.categoryMap.category, (completionCounts.get(completion.categoryMap.category) ?? 0) + 1);
  }

  const nextLevelMaps = await prisma.categoryMap.groupBy({
    by: ["category", "level"],
    where: { status: "approved" },
    _count: { _all: true },
  });
  const nextLevelMapCount = new Map<string, number>();
  for (const entry of nextLevelMaps) {
    nextLevelMapCount.set(`${entry.category}:${entry.level}`, entry._count._all);
  }

  const nextLevelCompletions = new Map<string, number>();
  for (const completion of completions) {
    const key = `${completion.categoryMap.category}:${completion.categoryMap.level}`;
    nextLevelCompletions.set(key, (nextLevelCompletions.get(key) ?? 0) + 1);
  }

  return CATEGORIES.map((category) => {
    const level = levelMap.get(category) ?? 0;
    const nextLevel = Math.min(MAX_CATEGORY_LEVEL, level + 1);
    return {
      category,
      label: CATEGORY_LABELS[category],
      level,
      completions: completionCounts.get(category) ?? 0,
      mapsAtNextLevel: nextLevelMapCount.get(`${category}:${nextLevel}`) ?? 0,
      mapsCompletedAtNextLevel: nextLevelCompletions.get(`${category}:${nextLevel}`) ?? 0,
    };
  });
}
