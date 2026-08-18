import { prisma } from "@/lib/db";

export const POST_REVIEWER_TAG_SLUG = "post-reviewer";

export async function canAccessApproval(
  user: { id: string } | null
): Promise<boolean> {
  if (!user) return false;

  const count = await prisma.userTag.count({
    where: {
      userId: user.id,
      tag: { slug: POST_REVIEWER_TAG_SLUG },
    },
  });

  return count > 0;
}
