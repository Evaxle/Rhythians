import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fetchRhythiaScores, findScoreForMap } from "@/lib/daily";
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
  if (user && state.currentMatch?.battleMatchId) viewerScore = (await prisma.$queryRawUnsafe<any[]>(`SELECT accuracy,"scoreSubmittedAt" FROM "BattleMatchPlayer" WHERE "matchId"=$1 AND "userId"=$2`, state.currentMatch.battleMatchId, user.id))[0] ?? null;
  return NextResponse.json({ ...publicTournamentState(state), viewerScore });
}

async function requireFreshNoModPass(tournamentId: string, userId: string) {
  const match = (await prisma.$queryRawUnsafe<Array<{ mapId: string; startedAt: Date | null }>>(`SELECT tm."mapId",tm."startedAt" FROM "TournamentMatch" tm JOIN "BattleMatchPlayer" bp ON bp."matchId"=tm."battleMatchId" AND bp."userId"=$2 WHERE tm."tournamentId"=$1 AND tm.status='active' ORDER BY tm.round DESC LIMIT 1`, tournamentId, userId))[0];
  if (!match?.mapId || !match.startedAt) throw new Error("You do not have an active tournament match.");
  const [map, profile] = await Promise.all([
    prisma.challengeMap.findUnique({ where: { id: match.mapId }, select: { title: true } }),
    prisma.rhythiaProfile.findUnique({ where: { userId }, select: { profileId: true } }),
  ]);
  if (!map || !profile) throw new Error("A linked Rhythia account is required for tournament scoring.");
  let recent;
  try { recent = (await fetchRhythiaScores(profile.profileId)).recent; } catch { throw new Error("Could not retrieve recent Rhythia scores."); }
  const score = findScoreForMap(recent, map.title);
  const createdAt = score?.created_at ? new Date(score.created_at).getTime() : NaN;
  const startMs = new Date(match.startedAt).getTime() - 5000;
  if (!score || score.passed !== true || score.speed !== 1 || !Number.isFinite(createdAt) || createdAt < startMs) throw new Error("Your newest pass for this tournament map must be a fresh No Mod (1.00x) pass played after the match starts. Play the map again with No Mod, then check your score.");
}

export async function POST(request: Request, { params }: Props) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json().catch(() => null) as { action?: unknown } | null;
  try {
    if (body?.action === "heartbeat") return NextResponse.json(await heartbeatTournament(id, user.id));
    if (body?.action === "check-score") {
      await requireFreshNoModPass(id, user.id);
      return NextResponse.json({ ok: true, ...(await submitTournamentScoreRuntime(id, user.id)) });
    }
    if (body?.action === "forfeit") return NextResponse.json(await forfeitTournamentMatchRuntime(id, user.id));
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Tournament action failed." }, { status: 400 });
  }
}
