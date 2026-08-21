export type Category = "jumps" | "stream" | "tech" | "off_grid";

export const CATEGORIES = ["jumps", "stream", "tech", "off_grid", "vibro" as Category] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  jumps: "Jumps",
  stream: "Stream",
  tech: "Tech",
  off_grid: "Off Grid",
  vibro: "Vibro",
};

export const MAX_CATEGORY_LEVEL = 10;

export function isCategory(value: string | null | undefined): value is Category {
  return CATEGORIES.includes(value as Category);
}
