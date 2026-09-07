import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { postponeDueTournaments } from "@/lib/tournament-schedule";
import { forfeitTournamentMatchRuntime, getTournamentRuntimeState, heartbeatTournament, submitTournamentScoreRuntime } from "@/lib/tournament-runtime";
import { publicTournamentState } from "@/lib/tournament-public-state";

type Props = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: Props) {
  const { id } = await params;
  const user = await getSessionUser();
  await postponeDueTournaments(id);
  const state = await getTournamentRuntimeState(id, user?.id ?? null);
  if (!state) return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
  let viewerScore = null;
  if (user && state.currentMatch?.battleMatchId) {
    viewerScore = (await prisma.$queryRawUnsafe<any[]>(`SELECT accuracy,"scoreSubmittedAt" FROM "BattleMatchPlayer" WHERE "matchId"=$1 AND "userId"=$2`, state.currentMatch.battleMatchId, user.id))[0] ?? null;
  }
  return NextResponse.json({ ...publicTournamentState(state), viewerScore });
}

export async function POST(request: Request, { params }: Props) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json().catch(() => null) as { action?: unknown } | null;
  try {
    if (body?.action === "heartbeat") return NextResponse.json(await heartbeatTournament(id, user.id));
    if (body?.action === "check-score") return NextResponse.json({ ok: true, ...(await submitTournamentScoreRuntime(id, user.id)) });
    if (body?.action === "forfeit") return NextResponse.json(await forfeitTournamentMatchRuntime(id, user.id));
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Tournament action failed." }, { status: 400 });
  }
}
