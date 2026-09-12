import { isCategory, type Category } from "./category-constants";

export function getProfileChallenge(
  savedFavorite: string | null | undefined,
  levels: ReadonlyArray<{ category: Category; level: number }> | null,
) {
  const category = isCategory(savedFavorite) ? savedFavorite : null;
  return {
    category,
    level:
      category && levels
        ? (levels.find((entry) => entry.category === category)?.level ?? 0)
        : null,
  };
}
