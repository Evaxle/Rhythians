import { NextResponse } from "next/server";
import { getSessionUser, isOwner } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fetchRhythiaProfile, parseRhythiaUrl } from "@/lib/rhythia";
import { rebuildRhythiaScorePoints } from "@/lib/rhythia-full-score-import";
import { fetchRhythiaAccountCreatedAt, syncAutomaticPlayerClassification } from "@/lib/player-classification";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = await getSessionUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOwner(admin)) return NextResponse.json({ error: "Only the site owner can change linked Rhythia accounts." }, { status: 403 });
  const body = await request.json().catch(() => null) as { action?: unknown; userId?: unknown; profileUrl?: unknown } | null;
  const userId = typeof body?.userId === "string" ? body.userId : "";
  if (!userId) return NextResponse.json({ error: "User is required." }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true, profileHandle: true, scoreImportDone: true, rhythiaProfile: { select: { profileId: true, profileUrl: true, username: true } } } });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  if (body?.action === "unlink") {
    if (!user.rhythiaProfile) return NextResponse.json({ error: "That user does not have a linked Rhythia profile." }, { status: 409 });
    const oldProfile = user.rhythiaProfile;
    await prisma.$transaction(async (tx) => {
      await tx.rhythiaModeScore.deleteMany({ where: { userId } });
      await tx.$executeRawUnsafe('DELETE FROM "RankingBaseline" WHERE "userId"=$1', userId);
      await tx.$executeRawUnsafe('DELETE FROM "UserPointOverride" WHERE "userId"=$1 AND "system" IN (\'rhp\',\'rpl\',\'rps\',\'rpv\')', userId);
      await tx.rhythiaProfile.delete({ where: { userId } });
      await tx.user.update({ where: { id: userId }, data: { rhythiaVerified: false, scoreImportDone: false, lastRhythiaRpCheckAt: null, playerRankId: null, rhp: 0 } });
      await tx.rhythiaProfileRequest.updateMany({ where: { userId, status: "pending" }, data: { status: "denied", adminNote: `Link removed by owner ${admin.username}.`, resolvedAt: new Date(), resolvedBy: admin.id } });
      await tx.notification.create({ data: { userId, type: "moderation", title: "Rhythia profile unlinked", message: "Your linked Rhythia profile was removed by the site owner. You can link a Rhythia account again from your profile.", url: "/settings" } });
      await tx.moderationAction.create({ data: { actorId: admin.id, action: "rhythia_profile_manually_unlinked", targetType: "user", targetId: userId, metadata: { profileId: oldProfile.profileId, profileUrl: oldProfile.profileUrl, rhythiaUsername: oldProfile.username } } });
    });
    return NextResponse.json({ ok: true, unlinked: true });
  }

  const profileUrl = typeof body?.profileUrl === "string" ? body.profileUrl.trim() : "";
  if (!profileUrl) return NextResponse.json({ error: "Rhythia profile URL is required." }, { status: 400 });
  const parsed = parseRhythiaUrl(profileUrl);
  if (!parsed) return NextResponse.json({ error: "Enter a valid Rhythia profile URL." }, { status: 400 });
  const linked = await prisma.rhythiaProfile.findUnique({ where: { profileId: parsed.id }, select: { userId: true } });
  if (linked && linked.userId !== userId) return NextResponse.json({ error: "That Rhythia profile is already linked to another user." }, { status: 409 });
  try {
    const profile = await fetchRhythiaProfile(parsed.id);
    const accountCreatedAt = await fetchRhythiaAccountCreatedAt(parsed.id).catch(() => null);
    const { bio: _bio, ...profileData } = profile;
    await prisma.$transaction(async (tx) => {
      await tx.rhythiaProfile.upsert({ where: { userId }, create: { userId, profileUrl: parsed.url, ...profileData }, update: { profileUrl: parsed.url, ...profileData, syncedAt: new Date() } });
      await tx.user.update({ where: { id: userId }, data: { rhythiaVerified: true } });
      await syncAutomaticPlayerClassification(tx, userId, profile.globalRank, accountCreatedAt);
      await tx.rhythiaProfileRequest.updateMany({ where: { userId, status: "pending" }, data: { status: "approved", adminNote: `Manually linked by owner ${admin.username}.`, resolvedAt: new Date(), resolvedBy: admin.id } });
      await tx.notification.create({ data: { userId, type: "moderation", title: "Rhythia profile linked", message: "Your Rhythia profile has been manually linked by the site owner.", url: "/settings" } });
      await tx.moderationAction.create({ data: { actorId: admin.id, action: "rhythia_profile_manually_linked", targetType: "user", targetId: userId, metadata: { profileId: profile.profileId, profileUrl: parsed.url } } });
    });
    let scoreImport = null;
    if (!user.scoreImportDone) try { scoreImport = await rebuildRhythiaScorePoints(userId); } catch {}
    return NextResponse.json({ ok: true, user: { id: user.id, username: user.username, profileHandle: user.profileHandle }, profile: profileData, scoreImport });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load that Rhythia profile." }, { status: 502 }); }
}

export async function GET(request: Request) {
  const admin = await getSessionUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOwner(admin)) return NextResponse.json({ error: "Only the site owner can manage linked Rhythia accounts." }, { status: 403 });
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({ users: [] });
  const users = await prisma.user.findMany({ where: { OR: [{ username: { contains: query, mode: "insensitive" } }, { profileHandle: { contains: query, mode: "insensitive" } }, { displayName: { contains: query, mode: "insensitive" } }, { discordId: { contains: query } }] }, select: { id: true, username: true, displayName: true, profileHandle: true, rhythiaVerified: true, rhythiaProfile: { select: { profileUrl: true, username: true, profileId: true } } }, orderBy: { username: "asc" }, take: 20 });
  return NextResponse.json({ users });
}
