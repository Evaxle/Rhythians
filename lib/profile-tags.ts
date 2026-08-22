import { prisma } from "@/lib/db";

type UserTag = { tag: { name: string; slug: string } };

export function selectProfileTags(tags: UserTag[], pinnedTagSlugs: string[] = []) {
  const bySlug = new Map(tags.map((item) => [item.tag.slug, item]));
  const selected: UserTag[] = [];
  for (const slug of pinnedTagSlugs) {
    const tag = bySlug.get(slug);
    if (tag && !selected.includes(tag)) selected.push(tag);
    if (selected.length === 3) return selected;
  }
  for (const tag of tags) {
    if (!selected.includes(tag)) selected.push(tag);
    if (selected.length === 3) break;
  }
  return selected;
}

export async function getPinnedTagSlugs(userId: string) {
  const setting = await prisma.siteSetting.findUnique({ where: { key: `profile.pinned-tags.${userId}` }, select: { value: true } });
  if (!setting) return [];
  try {
    const parsed = JSON.parse(setting.value);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string").slice(0, 3) : [];
  } catch {
    return [];
  }
}
