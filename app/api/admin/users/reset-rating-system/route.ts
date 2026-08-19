import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

export async function POST() {
  const admin = await getSessionUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canAccessAdmin(admin))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.challengeMapCompletion.deleteMany({});
      await tx.rhpTransaction.deleteMany({});
      const users = await tx.user.updateMany({
        data: {
          rhp: 0,
          avgMapRating: null,
          playerRankId: null,
          scoreImportDone: false,
        },
      });
      return users.count;
    });

    return NextResponse.json({ users: result, reset: true });
  } catch {
    return NextResponse.json({ error: "Unable to reset the rating system." }, { status: 500 });
  }
}
