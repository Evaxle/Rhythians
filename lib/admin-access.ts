import { prisma } from "@/lib/db";
import { isOwner } from "@/lib/auth";

export const ADMIN_TAG_SLUG = "admin";

export async function canAccessAdmin(
  user: { id: string; discordId?: string | null } | null
): Promise<boolean> {
  if (isOwner(user)) return true;
  if (!user) return false;

  const count = await prisma.userTag.count({
    where: {
      userId: user.id,
      tag: { slug: ADMIN_TAG_SLUG },
    },
  });

  return count > 0;
}