import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { runTournamentSelfTest } from "@/lib/tournament-self-test";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!(await canAccessAdmin(user))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const body = await request.json().catch(() => null) as { tournamentId?: unknown } | null;
  const tournamentId = typeof body?.tournamentId === "string" && body.tournamentId ? body.tournamentId : null;
  try {
    return NextResponse.json(await runTournamentSelfTest(tournamentId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Tournament self-test failed." }, { status: 500 });
  }
}
