import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fetchRhythiaProfile, namesMatch, parseRhythiaUrl } from "@/lib/rhythia";
import { awardRhythiaRpCredit, checkAndAwardAllChallengeMaps } from "@/lib/maps";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = typeof body?.url === "string" ? parseRhythiaUrl(body.url) : null;
  if (!parsed) return NextResponse.json({ error: "Enter a valid URL like https://www.rhythia.com/player/7564." }, { status: 400 });

  try {
    const profile = await fetchRhythiaProfile(parsed.id);
    const existing = await prisma.rhythiaProfile.findUnique({ where: { userId: user.id } });
    const alreadyLinked = existing?.profileId === parsed.id;

    if (!alreadyLinked && !namesMatch(profile.username, [user.username, user.displayName, user.profileHandle])) {
      return NextResponse.json(
        {
          error: "The name on that Rhythia profile doesn't match your account. You can send a request for an admin to review and approve it.",
          mismatch: true,
          candidate: { profileId: profile.profileId, profileUrl: parsed.url, username: profile.username },
        },
        { status: 422 }
      );
    }

    const saved = await prisma.$transaction(async (tx) => {
      const profileRow = await tx.rhythiaProfile.upsert({
        where: { userId: user.id },
        create: { userId: user.id, profileUrl: parsed.url, ...profile },
        update: { profileUrl: parsed.url, ...profile, syncedAt: new Date() },
      });
      await tx.user.update({ where: { id: user.id }, data: { rhythiaVerified: true } });
      return profileRow;
    });

    // On first connect: import historical passes (only maps in the user's rank
    // range award RHP), then weigh their total Rhythia RP into RHP. Importing
    // first lets the user climb through every rank they have passes for; the RP
    // credit then places them at their true skill rank.
    if (!user.scoreImportDone) {
      try {
        await checkAndAwardAllChallengeMaps(user.id);
      } catch {
        // The profile is linked either way; the user can import scores later from settings.
      }
    }
    try {
      await awardRhythiaRpCredit(user.id, profile.rhythmPoints);
    } catch {
      // The RP credit is best-effort; the profile is linked either way.
    }

    return NextResponse.json({ profile: saved });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load that Rhythia profile." }, { status: 502 });
  }
}
