import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import {
  addTournamentMap,
  buildTournamentBrackets,
  cancelTournament,
  createTournament,
  forceTournamentWinner,
  getTournamentAdminState,
  moveTournamentSeed,
  parseTournamentMode,
  parseTournamentSplit,
  removeTournamentMap,
  resolveSplitRequest,
  setSignupPriority,
  setSignupSplit,
  startTournament,
  swapTournamentMembers,
  updateTournament,
} from "@/lib/tournaments";

export const dynamic = "force-dynamic";

async function authorize() {
  const user = await getSessionUser();
  if (!user) return { response: NextResponse.json({ error: "Authentication required." }, { status: 401 }) } as const;
  if (!(await canAccessAdmin(user))) return { response: NextResponse.json({ error: "Forbidden." }, { status: 403 }) } as const;
  return { user } as const;
}

export async function GET(request: Request) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  const id = new URL(request.url).searchParams.get("id");
  return NextResponse.json(await getTournamentAdminState(id));
}

export async function POST(request: Request) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.action !== "string") return NextResponse.json({ error: "Action required." }, { status: 400 });
  try {
    if (body.action === "create") {
      const mode = parseTournamentMode(body.mode);
      const scheduledAt = typeof body.scheduledAt === "string" ? new Date(body.scheduledAt) : new Date(NaN);
      if (!mode || typeof body.name !== "string") throw new Error("Name, date, and tournament mode are required.");
      const id = await createTournament({ name: body.name, mode, scheduledAt, createdById: auth.user.id });
      return NextResponse.json({ ok: true, id, state: await getTournamentAdminState(id) }, { status: 201 });
    }
    const tournamentId = typeof body.tournamentId === "string" ? body.tournamentId : null;
    if (!tournamentId) throw new Error("Tournament required.");

    if (body.action === "update") {
      const mode = body.mode == null ? undefined : parseTournamentMode(body.mode) ?? undefined;
      const scheduledAt = typeof body.scheduledAt === "string" && body.scheduledAt ? new Date(body.scheduledAt) : undefined;
      await updateTournament(tournamentId, { name: typeof body.name === "string" ? body.name : undefined, mode, scheduledAt });
    } else if (body.action === "cancel") {
      await cancelTournament(tournamentId);
    } else if (body.action === "build") {
      await buildTournamentBrackets(tournamentId);
    } else if (body.action === "start") {
      await startTournament(tournamentId);
    } else if (body.action === "set-split") {
      const split = parseTournamentSplit(body.split);
      if (!split || typeof body.userId !== "string") throw new Error("User and split are required.");
      await setSignupSplit(tournamentId, body.userId, split);
    } else if (body.action === "resolve-split") {
      if (typeof body.userId !== "string" || typeof body.approve !== "boolean") throw new Error("Split request decision is incomplete.");
      await resolveSplitRequest(tournamentId, body.userId, body.approve);
    } else if (body.action === "priority") {
      if (typeof body.userId !== "string" || typeof body.priority !== "boolean") throw new Error("Priority update is incomplete.");
      await setSignupPriority(tournamentId, body.userId, body.priority);
    } else if (body.action === "add-map") {
      const split = parseTournamentSplit(body.split);
      if (!split || typeof body.mapId !== "string") throw new Error("Map and split are required.");
      await addTournamentMap(tournamentId, split, body.mapId);
    } else if (body.action === "remove-map") {
      const split = parseTournamentSplit(body.split);
      if (!split || typeof body.mapId !== "string") throw new Error("Map and split are required.");
      await removeTournamentMap(tournamentId, split, body.mapId);
    } else if (body.action === "move-seed") {
      if (typeof body.teamId !== "string" || body.direction !== -1 && body.direction !== 1) throw new Error("Team and direction are required.");
      await moveTournamentSeed(tournamentId, body.teamId, body.direction as -1 | 1);
    } else if (body.action === "swap-members") {
      if (typeof body.firstUserId !== "string" || typeof body.secondUserId !== "string") throw new Error("Select two players to swap.");
      await swapTournamentMembers(tournamentId, body.firstUserId, body.secondUserId);
    } else if (body.action === "force-winner") {
      if (typeof body.tournamentMatchId !== "string" || typeof body.winnerTeamId !== "string") throw new Error("Match and winner are required.");
      await forceTournamentWinner(body.tournamentMatchId, body.winnerTeamId);
    } else {
      throw new Error("Unknown action.");
    }
    return NextResponse.json({ ok: true, state: await getTournamentAdminState(tournamentId) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Tournament admin action failed." }, { status: 400 });
  }
}
