import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fetchRhythiaProfile, parseRhythiaUrl } from "@/lib/rhythia";

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

function matchesCode(value: string, storedHash: string) {
  const actual = Buffer.from(hashCode(value), "hex");
  const expected = Buffer.from(storedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const action = body?.action === "check" ? "check" : "start";

  if (action === "check") {
    const pending = await prisma.rhythiaProfileRequest.findFirst({ where: { userId: user.id, status: "pending" }, orderBy: { createdAt: "desc" } });
    if (!pending) return NextResponse.json({ error: "Start verification first." }, { status: 400 });
    if (!pending.adminNote || !pending.resolvedAt || pending.resolvedAt.getTime() <= Date.now()) {
      await prisma.rhythiaProfileRequest.delete({ where: { id: pending.id } });
      return NextResponse.json({ error: "Your verification code expired. Generate a new code." }, { status: 410 });
    }
    try {
      const code = String(body?.code ?? "").trim();
      if (!/^\d{8}$/.test(code) || !matchesCode(code, pending.adminNote)) return NextResponse.json({ error: "The verification code was not found in that profile bio." }, { status: 400 });
      const profile = await fetchRhythiaProfile(pending.profileId);
      if (!profile.bio || !profile.bio.includes(code)) return NextResponse.json({ error: "The verification code was not found in that profile bio." }, { status: 400 });
      const { bio: _bio, ...profileData } = profile;
      const saved = await prisma.$transaction(async (tx) => {
        const profileRow = await tx.rhythiaProfile.upsert({
          where: { userId: user.id },
          create: { userId: user.id, profileUrl: pending.profileUrl, ...profileData },
          update: { profileUrl: pending.profileUrl, ...profileData, syncedAt: new Date() },
        });
        await tx.user.update({ where: { id: user.id }, data: { rhythiaVerified: true } });
        await tx.rhythiaProfileRequest.delete({ where: { id: pending.id } });
        return profileRow;
      });
      return NextResponse.json({ verified: true, profile: saved, message: "Your Rhythia account is verified. You can now remove the verification code from your Rhythia bio." });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to check that Rhythia profile." }, { status: 502 });
    }
  }

  const parsed = typeof body?.url === "string" ? parseRhythiaUrl(body.url) : null;
  if (!parsed) return NextResponse.json({ error: "Enter a valid URL like https://www.rhythia.com/player/7564." }, { status: 400 });

  try {
    const existingProfile = await prisma.rhythiaProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (existingProfile) return NextResponse.json({ error: "Your Rhythia account is already linked." }, { status: 409 });
    const profile = await fetchRhythiaProfile(parsed.id);
    const activeForProfile = await prisma.rhythiaProfile.findUnique({ where: { profileId: profile.profileId }, select: { userId: true } });
    if (activeForProfile && activeForProfile.userId !== user.id) return NextResponse.json({ error: "That Rhythia profile is already linked to another account." }, { status: 409 });

    await prisma.rhythiaProfileRequest.deleteMany({ where: { userId: user.id, status: "pending" } });
    const code = String(randomInt(10000000, 100000000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await prisma.rhythiaProfileRequest.create({
      data: {
        userId: user.id,
        profileId: profile.profileId,
        profileUrl: parsed.url,
        rhythiaUsername: profile.username ?? "Unknown",
        claimedUsername: user.username,
        adminNote: hashCode(code),
        resolvedAt: expiresAt,
      },
    });
    return NextResponse.json({ verification: { code, expiresAt: expiresAt.toISOString(), profileUrl: parsed.url, username: profile.username } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load that Rhythia profile." }, { status: 502 });
  }
}
