import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkAndAwardAllChallengeMaps } from "@/lib/maps";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!profile) return NextResponse.json({ error: "Link your Rhythia account to check your scores." }, { status: 403 });

  const challengeMapCount = await prisma.challengeMap.count({
    where: { status: "approved", rating: { not: null }, isAutoImported: false },
  });

  if (challengeMapCount === 0) {
    await prisma.user.update({ where: { id: user.id }, data: { scoreImportDone: true } });
    return NextResponse.json({ checked: 0, awarded: 0, newlyCompleted: 0, totalPoints: 0, rankIndex: 0 });
  }

  try {
    const result = await checkAndAwardAllChallengeMaps(user.id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to check your scores." }, { status: 400 });
  }
}
