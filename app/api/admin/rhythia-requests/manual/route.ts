import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/db";
import { fetchRhythiaProfile, parseRhythiaUrl } from "@/lib/rhythia";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = await getSessionUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canAccessAdmin(admin))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as { userId?: unknown; profileUrl?: unknown } | null;
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const profileUrl = typeof body?.profileUrl === "string" ? body.profileUrl.trim() : "";
  if (!userId || !profileUrl) return NextResponse.json({ error: "User and Rhythia profile URL are required." }, { status: 400 });
  const parsed = parseRhythiaUrl(profileUrl);
  if (!parsed) return NextResponse.json({ error: "Enter a valid Rhythia profile URL." }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true, profileHandle: true } });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
  const linked = await prisma.rhythiaProfile.findUnique({ where: { profileId: parsed.id }, select: { userId: true } });
  if (linked && linked.userId !== userId) return NextResponse.json({ error: "That Rhythia profile is already linked to another user." }, { status: 409 });

  try {
    const profile = await fetchRhythiaProfile(parsed.id);
    const { bio: _bio, ...profileData } = profile;
    await prisma.$transaction(async (tx) => {
      await tx.rhythiaProfile.upsert({ where: { userId }, create: { userId, profileUrl: parsed.url, ...profileData }, update: { profileUrl: parsed.url, ...profileData, syncedAt: new Date() } });
      await tx.user.update({ where: { id: userId }, data: { rhythiaVerified: true } });
      await tx.rhythiaProfileRequest.updateMany({ where: { userId, status: "pending" }, data: { status: "approved", adminNote: `Manually linked by admin ${admin.username}.`, resolvedAt: new Date(), resolvedBy: admin.id } });
      await tx.notification.create({ data: { userId, type: "moderation", title: "Rhythia profile linked", message: `Your Rhythia profile has been manually linked by an admin.`, url: "/settings" } });
      await tx.moderationAction.create({ data: { actorId: admin.id, action: "rhythia_profile_manually_linked", targetType: "user", targetId: userId, metadata: { profileId: profile.profileId, profileUrl: parsed.url } } });
    });
    return NextResponse.json({ ok: true, user: { id: user.id, username: user.username, profileHandle: user.profileHandle }, profile: profileData });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load that Rhythia profile." }, { status: 502 });
  }
}

export async function GET(request: Request) {
  const admin = await getSessionUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canAccessAdmin(admin))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({ users: [] });
  const users = await prisma.user.findMany({ where: { OR: [{ username: { contains: query, mode: "insensitive" } }, { profileHandle: { contains: query, mode: "insensitive" } }, { displayName: { contains: query, mode: "insensitive" } }, { discordId: { contains: query } }] }, select: { id: true, username: true, displayName: true, profileHandle: true, rhythiaVerified: true, rhythiaProfile: { select: { profileUrl: true, username: true, profileId: true } } }, orderBy: { username: "asc" }, take: 20 });
  return NextResponse.json({ users });
}
