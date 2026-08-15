import { prisma } from "@/lib/db";
import { isOwner } from "@/lib/auth";

export const POST_REVIEWER_TAG_SLUG = "post-reviewer";

export async function canAccessApproval(
  user: { id: string; discordId?: string | null } | null
): Promise<boolean> {
  if (!user) return false;
  if (isOwner(user)) return true;

  const count = await prisma.userTag.count({
    where: {
      userId: user.id,
      tag: { slug: POST_REVIEWER_TAG_SLUG },
    },
  });

  return count > 0;
}
