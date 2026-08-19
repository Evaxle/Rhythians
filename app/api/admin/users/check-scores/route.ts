import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/db";
import { checkAndAwardAllChallengeMaps } from "@/lib/maps";

export const dynamic = "force-dynamic";

async function checkUser(userId: string) {
  let passes = 0;
  let checked = 0;
  let awarded = 0;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const result = await checkAndAwardAllChallengeMaps(userId);
    checked += result.checked;
    awarded += result.awarded;
    passes += 1;
    if (result.awarded <= 0) break;
  }
  return { passes, checked, awarded };
}

export async function POST(request: Request) {
  const admin = await getSessionUser();
  if (!admin) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!(await canAccessAdmin(admin))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const body = await request.json().catch(() => null) as { userId?: unknown; all?: unknown } | null;
  const all = body?.all === true;
  const userId = typeof body?.userId === "string" ? body.userId : null;

  try {
    if (all) {
      const users = await prisma.user.findMany({ where: { rhythiaProfile: { isNot: null } }, select: { id: true } });
      let checked = 0;
      let awarded = 0;
      let completed = 0;
      for (const user of users) {
        const result = await checkUser(user.id);
        checked += result.checked;
        awarded += result.awarded;
        completed += 1;
      }
      return NextResponse.json({ mode: "all", users: completed, checked, awarded });
    }

    if (!userId) return NextResponse.json({ error: "userId is required." }, { status: 400 });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true, displayName: true, rhythiaProfile: { select: { id: true } } } });
    if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
    if (!user.rhythiaProfile) return NextResponse.json({ error: "This user does not have a linked Rhythia profile." }, { status: 400 });

    const result = await checkUser(user.id);
    return NextResponse.json({ mode: "user", user: { id: user.id, username: user.username, displayName: user.displayName }, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to check ranked scores." }, { status: 500 });
  }
}
