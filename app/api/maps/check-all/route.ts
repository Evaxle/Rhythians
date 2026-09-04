import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { syncUserModeScores } from "@/lib/rhythia-mode-points";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  try {
    const result = await syncUserModeScores(user.id);
    return NextResponse.json({ checked: result.rows.length, foundScores: result.rows.length, awarded: result.added, rpl: result.rpl, rps: result.rps, rpv: result.rpv, rhp: result.rhp, foundModes: result.foundModes });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to check your scores." }, { status: 400 });
  }
}
