import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, isOwner } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { isCurrentlySuspended, isCurrentlyMuted } from "@/lib/user-moderation";
import { getUserCategoryLevels } from "@/lib/categories";
import { getUserChallengeLevel } from "@/lib/challenge";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = await getSessionUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canAccessAdmin(admin))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ error: "Search for at least 2 characters." }, { status: 400 });

  const user = await prisma.user.findFirst({
    where: { OR: [
      { username: { contains: q, mode: "insensitive" } },
      { displayName: { contains: q, mode: "insensitive" } },
      { profileHandle: { contains: q, mode: "insensitive" } },
      { discordId: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ] },
    include: {
      userTags: { include: { tag: true } },
      roles: { include: { role: true } },
      playerRank: { select: { name: true } },
      rhythiaProfile: { select: { profileId: true, profileUrl: true, username: true, country: true, flag: true, globalRank: true, countryRank: true, rhythmPoints: true, isOnline: true, lastActiveAt: true, syncedAt: true } },
      warnings: { orderBy: { createdAt: "desc" }, take: 20, include: { actor: { select: { username: true, displayName: true } } } },
      _count: { select: { clips: true, comments: true, messagesSent: true, reports: true, warnings: true, challengeCompletions: true, dailyMapBeats: true, rhpTransactions: true } },
    },
  });

  if (!user) return NextResponse.json({ user: null });

  const moderation = {
    isSuspended: isCurrentlySuspended(user),
    suspensionExpiry: user.isSuspended && !user.suspendedUntil ? null : user.suspendedUntil,
    isMuted: isCurrentlyMuted(user),
    muteExpiry: user.mutedUntil && user.mutedUntil > new Date() ? user.mutedUntil : null,
  };
  const [challengeLevel, categoryLevels, titleRows] = await Promise.all([
    getUserChallengeLevel(user.id),
    getUserCategoryLevels(user.id),
    prisma.$queryRawUnsafe<Array<{ title: string; color: string }>>('SELECT "title", "color" FROM "UserProfileTitle" WHERE "userId" = $1 LIMIT 1', user.id),
  ]);

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      discriminator: user.discriminator,
      displayName: user.displayName,
      profileHandle: user.profileHandle,
      discordId: user.discordId,
      email: user.email,
      hasPassword: Boolean(user.passwordHash),
      avatar: user.avatar,
      bio: user.bio,
      website: user.website,
      inGuild: user.inGuild,
      joinedAt: user.joinedAt.toISOString(),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      onboardingCompleted: user.onboardingCompleted,
      playerRank: user.playerRank?.name ?? null,
      userTags: user.userTags.map((ut) => ({ tag: { name: ut.tag.name, slug: ut.tag.slug } })),
      roles: user.roles.map((ur) => ur.role.name),
      warnings: user.warnings.map((warning) => ({ id: warning.id, reason: warning.reason, createdAt: warning.createdAt.toISOString(), actor: warning.actor.displayName ?? warning.actor.username })),
      rhythiaProfile: user.rhythiaProfile ? { profileId: user.rhythiaProfile.profileId, profileUrl: user.rhythiaProfile.profileUrl, username: user.rhythiaProfile.username, country: user.rhythiaProfile.country, flag: user.rhythiaProfile.flag, globalRank: user.rhythiaProfile.globalRank, countryRank: user.rhythiaProfile.countryRank, rhythmPoints: user.rhythiaProfile.rhythmPoints, isOnline: user.rhythiaProfile.isOnline, lastActiveAt: user.rhythiaProfile.lastActiveAt?.toISOString() ?? null, syncedAt: user.rhythiaProfile.syncedAt.toISOString() } : null,
      stats: { clips: user._count.clips, comments: user._count.comments, messages: user._count.messagesSent, reportsFiled: user._count.reports, warnings: user._count.warnings },
      ranked: { rhp: user.rhp, avgMapRating: user.avgMapRating, scoreImportDone: user.scoreImportDone, dailyStreak: user.dailyStreak, lastDailyBeatAt: user.lastDailyBeatAt?.toISOString() ?? null, lastRhythiaRpCheckAt: user.lastRhythiaRpCheckAt?.toISOString() ?? null, rhythiaVerified: user.rhythiaVerified, completions: user._count.challengeCompletions, dailyBeats: user._count.dailyMapBeats, rhpTransactions: user._count.rhpTransactions },
      challengeLevel,
      categoryLevels,
      profileTitle: titleRows[0]?.title ?? "",
      profileTitleColor: titleRows[0]?.color ?? "#a78bfa",
      canEditTitle: isOwner(admin),
      moderation,
    },
  });
}