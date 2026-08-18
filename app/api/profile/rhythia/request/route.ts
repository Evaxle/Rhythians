import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fetchRhythiaProfile, namesMatch, parseRhythiaUrl } from "@/lib/rhythia";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = typeof body?.url === "string" ? parseRhythiaUrl(body.url) : null;
  if (!parsed) return NextResponse.json({ error: "Enter a valid URL like https://www.rhythia.com/player/7564." }, { status: 400 });

  try {
    const profile = await fetchRhythiaProfile(parsed.id);

    if (namesMatch(profile.username, [user.username, user.displayName, user.profileHandle])) {
      const saved = await prisma.$transaction(async (tx) => {
        const profileRow = await tx.rhythiaProfile.upsert({
          where: { userId: user.id },
          create: { userId: user.id, profileUrl: parsed.url, ...profile },
          update: { profileUrl: parsed.url, ...profile, syncedAt: new Date() },
        });
        await tx.user.update({ where: { id: user.id }, data: { rhythiaVerified: true } });
        return profileRow;
      });
      return NextResponse.json({ profile: saved });
    }

    const pending = await prisma.rhythiaProfileRequest.findFirst({ where: { userId: user.id, status: "pending" } });
    if (pending) {
      return NextResponse.json({ error: "You already have a pending request that an admin needs to review.", alreadyRequested: true }, { status: 409 });
    }

    await prisma.rhythiaProfileRequest.create({
      data: {
        userId: user.id,
        profileId: profile.profileId,
        profileUrl: parsed.url,
        rhythiaUsername: profile.username ?? "Unknown",
        claimedUsername: user.username,
      },
    });

    const ownerId = process.env.OWNER_DISCORD_ID;
    if (ownerId) {
      const owner = await prisma.user.findUnique({ where: { discordId: ownerId } });
      if (owner) {
        await prisma.notification.create({
          data: {
            userId: owner.id,
            type: "moderation",
            title: "New Rhythia profile link request",
            message: `${user.username} requested to link the Rhythia profile "${profile.username ?? "Unknown"}" (${parsed.url}).`,
            url: "/admin/rhythia-requests",
          },
        });
      }
    }

    return NextResponse.json({ requested: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load that Rhythia profile." }, { status: 502 });
  }
}
