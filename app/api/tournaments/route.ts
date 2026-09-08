import "@/lib/tournament-cap-overrides";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fetchRhythiaProfile } from "@/lib/rhythia";
import { fetchRhythiaAccountCreatedAt, syncAutomaticPlayerClassification } from "@/lib/player-classification";
import { postponeDueTournaments } from "@/lib/tournament-schedule";
import { prepareTournamentCapacityForSignup } from "@/lib/tournament-cap-overrides";
import { parseTournamentSplit, requestTournamentSplit, splitForRhp, withdrawTournamentSignup, type TournamentSplit } from "@/lib/tournaments";
import { getTournamentRuntimeState, getTournamentsRuntimeHome, registerForTournamentRuntime } from "@/lib/tournament-runtime";
import { publicTournamentHome, publicTournamentState } from "@/lib/tournament-public-state";

export const dynamic = "force-dynamic";

async function tournamentSplitForUser(userId: string, fallbackRhp: number): Promise<TournamentSplit> {
  const linked = await prisma.rhythiaProfile.findUnique({ where: { userId }, select: { profileId: true, globalRank: true } });
  if (!linked) return splitForRhp(fallbackRhp);
  let globalRank = linked.globalRank;
  try {
    const profile = await fetchRhythiaProfile(linked.profileId);
    const accountCreatedAt = await fetchRhythiaAccountCreatedAt(linked.profileId).catch(() => null);
    globalRank = profile.globalRank;
    await prisma.$transaction(async (tx) => {
      await tx.rhythiaProfile.update({ where: { userId }, data: { globalRank: profile.globalRank, countryRank: profile.countryRank, rhythmPoints: profile.rhythmPoints, username: profile.username, country: profile.country, flag: profile.flag, title: profile.title, syncedAt: new Date() } });
      await syncAutomaticPlayerClassification(tx, userId, profile.globalRank, accountCreatedAt);
    });
  } catch {}
  if (typeof globalRank === "number" && Number.isFinite(globalRank) && globalRank > 0) return globalRank <= 500 ? "higher" : "lower";
  return splitForRhp(fallbackRhp);
}

export async function GET() {
  const user = await getSessionUser();
  await postponeDueTournaments();
  const home = await getTournamentsRuntimeHome(user?.id ?? null);
  if (user && home.scheduled) {
    const signupSplit = home.scheduled.viewerSignup?.status !== "withdrawn" ? home.scheduled.viewerSignup?.split : null;
    (home.scheduled as any).viewerSplit = signupSplit === "lower" || signupSplit === "higher" ? signupSplit : await tournamentSplitForUser(user.id, Number(user.rhp ?? 0));
  }
  return NextResponse.json(publicTournamentHome(home));
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json().catch(() => null) as { action?: unknown; tournamentId?: unknown; split?: unknown; streamOptIn?: unknown; streamPlatform?: unknown; streamIdentity?: unknown } | null;
  if (!body || typeof body.tournamentId !== "string") return NextResponse.json({ error: "Tournament required." }, { status: 400 });
  try {
    if (body.action === "signup") {
      const split = await tournamentSplitForUser(user.id, Number(user.rhp ?? 0));
      await prepareTournamentCapacityForSignup(body.tournamentId, split);
      await registerForTournamentRuntime(body.tournamentId, {
        id: user.id,
        streamOptIn: body.streamOptIn === true,
        streamPlatform: body.streamPlatform,
        streamIdentity: body.streamIdentity,
      });
      await prisma.$executeRawUnsafe(
        `UPDATE "TournamentSignup" SET split=$3,"requestedSplit"=NULL,"splitRequestStatus"='none',"updatedAt"=CURRENT_TIMESTAMP WHERE "tournamentId"=$1 AND "userId"=$2 AND status NOT IN ('withdrawn','kicked')`,
        body.tournamentId, user.id, split,
      );
      const state = await getTournamentRuntimeState(body.tournamentId, user.id);
      return NextResponse.json({ ok: true, state: publicTournamentState(state) });
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
