import { getCategoryMaps, getUserCategoryLevel, checkAndAwardCategoryMap } from "@/lib/categories";
import { MAX_CATEGORY_LEVEL, type Category } from "@/lib/category-constants";

export async function checkCategoryLevel(userId: string, category: Category, level: number) {
  if (!Number.isInteger(level) || level < 1 || level > Math.min(6, MAX_CATEGORY_LEVEL)) throw new Error("Automatic level checking is only available for Levels 1-6.");
  const currentLevel = await getUserCategoryLevel(userId, category);
  if (level > currentLevel + 1) throw new Error(`Level ${level} is locked.`);
  const maps = await getCategoryMaps(category, level);
  let passed = 0;
  let already = 0;
  let notBeat = 0;
  for (const map of maps) {
    const result = await checkAndAwardCategoryMap(userId, map.id);
    if (result.status === "passed" || result.status === "level_up") passed += 1;
    else if (result.status === "already") already += 1;
    else if (result.status === "not_beat") notBeat += 1;
  }
  return { checked: maps.length, passed, already, notBeat, level: await getUserCategoryLevel(userId, category) };
}
