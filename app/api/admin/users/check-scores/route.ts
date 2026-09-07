import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/db";
import { checkAllRankedMaps } from "@/lib/ranked-map-check";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BATCH_SIZE = 4;

type ScanFailure = {
  userId: string;
  username: string;
  error: string;
};

export async function POST(request: Request) {
  const admin = await getSessionUser();
  if (!admin) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!(await canAccessAdmin(admin))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const body = await request.json().catch(() => null) as { userId?: unknown; all?: unknown } | null;
  const all = body?.all === true;
  const userId = typeof body?.userId === "string" ? body.userId : null;

  try {
    if (all) {
      const users = await prisma.user.findMany({
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          username: true,
          displayName: true,
          rhythiaProfile: { select: { profileId: true } },
        },
      });

      const linkedUsers = users.filter((user) => user.rhythiaProfile?.profileId != null);
      const unlinkedUsers = users.filter((user) => user.rhythiaProfile?.profileId == null);

      let usersChecked = 0;
      let mapsChecked = 0;
      let foundScores = 0;
      let alreadyCompleted = 0;
      let newlyCompleted = 0;
      let awardedPoints = 0;
      const failures: ScanFailure[] = [];

      for (let index = 0; index < linkedUsers.length; index += BATCH_SIZE) {
        const batch = linkedUsers.slice(index, index + BATCH_SIZE);
        const results = await Promise.all(batch.map(async (user) => {
          try {
            const result = await checkAllRankedMaps(user.id);
            return { user, result, error: null as string | null };
          } catch (error) {
            return {
              user,
              result: null,
              error: error instanceof Error ? error.message : "Unable to check this user's Rhythia scores.",
            };
          }
        }));

        for (const item of results) {
          if (!item.result) {
            failures.push({ userId: item.user.id, username: item.user.username, error: item.error ?? "Unknown scan error." });
            continue;
          }
          usersChecked += 1;
          mapsChecked += item.result.checked;
          foundScores += item.result.foundScores;
          alreadyCompleted += item.result.alreadyCompleted;
          newlyCompleted += item.result.newlyCompleted;
          awardedPoints += item.result.totalPoints;
        }
      }

      return NextResponse.json({
        mode: "all",
        totalUsers: users.length,
        linkedUsers: linkedUsers.length,
        usersChecked,
        skippedUnlinked: unlinkedUsers.length,
        failedUsers: failures.length,
        mapsChecked,
        foundScores,
        alreadyCompleted,
        newlyCompleted,
        awardedPoints,
        failures,
      });
    }

    if (!userId) return NextResponse.json({ error: "userId is required." }, { status: 400 });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        displayName: true,
        rhythiaProfile: { select: { profileId: true } },
      },
    });

    if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
    if (!user.rhythiaProfile) return NextResponse.json({ error: "This user does not have a linked Rhythia profile." }, { status: 400 });

    const result = await checkAllRankedMaps(user.id);
    return NextResponse.json({
      mode: "user",
      user: { id: user.id, username: user.username, displayName: user.displayName },
      mapsChecked: result.checked,
      foundScores: result.foundScores,
      alreadyCompleted: result.alreadyCompleted,
      newlyCompleted: result.newlyCompleted,
      awardedPoints: result.totalPoints,
      rankIndex: result.rankIndex,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to check ranked scores." }, { status: 500 });
  }
}
