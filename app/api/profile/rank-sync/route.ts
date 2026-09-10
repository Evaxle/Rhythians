import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { reconcileStoredRhp } from "@/lib/rhp-reconcile";
import { syncUserModeScores } from "@/lib/rhythia-mode-points";
import { applyRecentPassBalance } from "@/lib/rhythia-pass-analysis";

export const dynamic = "force-dynamic";
const RECENT_SCORE_SYNC_MS = 2 * 60 * 1000;

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const before = await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { lastRhythiaRpCheckAt: true } });
  if (!before) return NextResponse.json({ error: "User not found." }, { status: 404 });
  const due = !before.lastRhythiaRpCheckAt || Date.now() - before.lastRhythiaRpCheckAt.getTime() >= RECENT_SCORE_SYNC_MS;
  let synced = false;
  let passAnalysis = { checked: 0, analyzed: 0, adjusted: 0, unavailable: 0, errors: 0 };
  if (due) {
    try {
      await syncUserModeScores(sessionUser.id);
      passAnalysis = await applyRecentPassBalance(sessionUser.id).catch(() => passAnalysis);
      await reconcileStoredRhp(sessionUser.id);
      synced = true;
    } catch { await reconcileStoredRhp(sessionUser.id); }
  } else await reconcileStoredRhp(sessionUser.id);
  const user = await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { rhp: true, updatedAt: true } });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
  return NextResponse.json({ rhp: user.rhp, updatedAt: user.updatedAt.toISOString(), synced, passAnalysis }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
}
