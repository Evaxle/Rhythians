import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { postponeDueTournaments } from "@/lib/tournament-schedule";
import { getTournamentsHome, parseTournamentSplit, registerForTournament, requestTournamentSplit, withdrawTournamentSignup } from "@/lib/tournaments";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  await postponeDueTournaments();
  return NextResponse.json(await getTournamentsHome(user?.id ?? null));
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json().catch(() => null) as { action?: unknown; tournamentId?: unknown; split?: unknown; streamOptIn?: unknown; streamPlatform?: unknown; streamIdentity?: unknown } | null;
  if (!body || typeof body.tournamentId !== "string") return NextResponse.json({ error: "Tournament required." }, { status: 400 });
  try {
    if (body.action === "signup") {
      const state = await registerForTournament(body.tournamentId, {
        id: user.id,
        streamOptIn: body.streamOptIn === true,
        streamPlatform: body.streamPlatform,
        streamIdentity: body.streamIdentity,
      });
      return NextResponse.json({ ok: true, state });
    }
    if (body.action === "withdraw") {
      await withdrawTournamentSignup(body.tournamentId, user.id);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "request-split") {
      const split = parseTournamentSplit(body.split);
      if (!split) return NextResponse.json({ error: "A valid split is required." }, { status: 400 });
      await requestTournamentSplit(body.tournamentId, user.id, split);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Tournament action failed." }, { status: 400 });
  }
}
