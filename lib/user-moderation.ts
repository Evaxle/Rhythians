import { prisma } from "@/lib/db";

export function isCurrentlySuspended(user: { isSuspended: boolean; suspendedUntil: Date | null }): boolean {
  if (user.isSuspended) return true;
  return Boolean(user.suspendedUntil && user.suspendedUntil > new Date());
}

export function isCurrentlyMuted(user: { mutedUntil: Date | null }): boolean {
  return Boolean(user.mutedUntil && user.mutedUntil > new Date());
}

export function getSuspensionExpiry(user: { isSuspended: boolean; suspendedUntil: Date | null }): Date | null {
  if (user.isSuspended && !user.suspendedUntil) return null;
  if (user.suspendedUntil && user.suspendedUntil > new Date()) return user.suspendedUntil;
  return null;
}

export function getMuteExpiry(user: { mutedUntil: Date | null }): Date | null {
  if (user.mutedUntil && user.mutedUntil > new Date()) return user.mutedUntil;
  return null;
}

export async function getModerationStatus(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isSuspended: true,
      suspendedUntil: true,
      mutedUntil: true,
    },
  });
  if (!user) return null;
  return {
    isSuspended: isCurrentlySuspended(user),
    suspensionExpiry: getSuspensionExpiry(user),
    isMuted: isCurrentlyMuted(user),
    muteExpiry: getMuteExpiry(user),
  };
}

export async function warnUser(actorId: string, userId: string, reason: string) {
  const trimmed = reason.trim().slice(0, 1000);
  if (!trimmed) return { error: "A warning message is required.", status: 400 };

  await prisma.userWarning.create({
    data: { userId, actorId, reason: trimmed },
  });

  await prisma.notification.create({
    data: {
      userId,
      type: "moderation",
      title: "You have received a warning",
      message: trimmed,
      url: "/notifications",
    },
  });

  await prisma.moderationAction.create({
    data: {
      actorId,
      action: "user_warned",
      targetType: "user",
      targetId: userId,
      metadata: { reason: trimmed },
    },
  });

  return { ok: true };
}