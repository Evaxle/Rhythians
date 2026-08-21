export const CATEGORIES = ["jumps", "stream", "tech", "off_grid"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  jumps: "Jumps",
  stream: "Stream",
  tech: "Tech",
  off_grid: "Off Grid",
};

export const MAX_CATEGORY_LEVEL = 10;

export function isCategory(value: string | null | undefined): value is Category {
  return CATEGORIES.includes(value as Category);
}
