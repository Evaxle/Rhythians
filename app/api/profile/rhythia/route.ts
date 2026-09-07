import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fetchRhythiaProfile, namesMatch, parseRhythiaUrl } from "@/lib/rhythia";
import { rebuildRhythiaScorePoints } from "@/lib/rhythia-full-score-import";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = typeof body?.url === "string" ? parseRhythiaUrl(body.url) : null;
  if (!parsed) return NextResponse.json({ error: "Enter a valid URL like https://www.rhythia.com/player/7564." }, { status: 400 });
  try {
    const profile = await fetchRhythiaProfile(parsed.id);
    const [existing, currentUser] = await Promise.all([
      prisma.rhythiaProfile.findUnique({ where: { userId: user.id } }),
      prisma.user.findUnique({ where: { id: user.id }, select: { scoreImportDone: true } }),
    ]);
    const alreadyLinked = existing?.profileId === parsed.id;
    if (!alreadyLinked && !namesMatch(profile.username, [user.username, user.displayName, user.profileHandle])) return NextResponse.json({ error: "The name on that Rhythia profile doesn't match your account. Use the bio verification flow to prove ownership.", mismatch: true, candidate: { profileId: profile.profileId, profileUrl: parsed.url, username: profile.username } }, { status: 422 });
    const { bio: _bio, ...profileData } = profile;
    const saved = await prisma.$transaction(async (tx) => {
      const profileRow = await tx.rhythiaProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, profileUrl: parsed.url, ...profileData }, update: { profileUrl: parsed.url, ...profileData, syncedAt: new Date() } });
      await tx.user.update({ where: { id: user.id }, data: { rhythiaVerified: true } });
      return profileRow;
    });
    let scoreImport = null;
    if (!alreadyLinked || !currentUser?.scoreImportDone) {
      try { scoreImport = await rebuildRhythiaScorePoints(user.id); } catch (error) { return NextResponse.json({ profile: saved, scoreImportWarning: error instanceof Error ? error.message : "The Rhythia score import could not be completed." }); }
    }
    return NextResponse.json({ profile: saved, scoreImport });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load that Rhythia profile." }, { status: 502 });
  }
}
