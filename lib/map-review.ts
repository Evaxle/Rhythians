import { prisma } from "@/lib/db";

export const MAP_REVIEWER_TAG_SLUG = "map-reviewer";

export async function canReviewMaps(user: { id: string } | null): Promise<boolean> {
  if (!user) return false;
  const count = await prisma.userTag.count({
    where: {
      userId: user.id,
      tag: { slug: MAP_REVIEWER_TAG_SLUG },
    },
  });
  return count > 0;
}

export async function getUserReviewRoles(user: { id: string } | null) {
  if (!user) return { reviewsPosts: false, reviewsMaps: false };
  const tags = await prisma.userTag.findMany({
    where: { userId: user.id },
    select: { tag: { select: { slug: true } } },
  });
  const slugs = new Set(tags.map((entry) => entry.tag.slug));
  return {
    reviewsPosts: slugs.has("post-reviewer"),
    reviewsMaps: slugs.has(MAP_REVIEWER_TAG_SLUG),
  };
}