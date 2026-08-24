import { prisma } from "@/lib/db";
import { isOwner } from "@/lib/auth";

export const ADMIN_TAG_SLUG = "admin";
export const STAFF_TAG_SLUG = "staff";

export async function hasAdminTag(user: { id: string } | null): Promise<boolean> {
  if (!user) return false;
  return (await prisma.userTag.count({ where: { userId: user.id, tag: { slug: ADMIN_TAG_SLUG } } })) > 0;
}

export async function hasStaffTag(user: { id: string } | null): Promise<boolean> {
  if (!user) return false;
  return (await prisma.userTag.count({ where: { userId: user.id, tag: { slug: STAFF_TAG_SLUG } } })) > 0;
}

export async function canAccessAdmin(user: { id: string; discordId?: string | null } | null): Promise<boolean> {
  if (isOwner(user)) return true;
  return hasAdminTag(user);
}

export async function canAccessRhythiaReview(user: { id: string; discordId?: string | null } | null): Promise<boolean> {
  if (isOwner(user)) return true;
  return (await hasAdminTag(user)) || (await hasStaffTag(user));
}
