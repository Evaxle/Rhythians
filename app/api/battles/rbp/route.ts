import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getRbpProfile, getRbpRecent, forfeitRbpMatch, resolveFinishedRbpMatch } from "@/lib/rbp";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const matchId = new URL(request.url).searchParams.get("matchId");
  if (!matchId) {
    const [profile, recent] = await Promise.all([getRbpProfile(user.id), getRbpRecent(user.id)]);
    return NextResponse.json({ profile, recent });
  }
  const match = await prisma.$queryRawUnsafe<Array<{ status: string; matchType: string }>>('SELECT "status","matchType" FROM "BattleMatch" WHERE "id" = $1 LIMIT 1', matchId);
  if (!match[0]) return NextResponse.json({ error: "Match not found." }, { status: 404 });
  const member = await prisma.$queryRawUnsafe<Array<{ team: number }>>('SELECT "team" FROM "BattleMatchPlayer" WHERE "matchId" = $1 AND "userId" = $2 LIMIT 1', matchId, user.id);
  if (!member[0]) return NextResponse.json({ error: "You are not part of this battle." }, { status: 403 });
  if (match[0].matchType === "ranked" && match[0].status === "finished") await resolveFinishedRbpMatch(matchId);
  const result = await prisma.$queryRawUnsafe<Array<{ result: string; delta: number; accuracy: number | null; opponentAccuracy: number | null; reason: string | null }>>('SELECT "result","delta","accuracy","opponentAccuracy","reason" FROM "RbpMatchResult" WHERE "matchId" = $1 AND "userId" = $2 ORDER BY "createdAt" DESC LIMIT 1', matchId, user.id);
  return NextResponse.json({ ranked: match[0].matchType === "ranked", status: match[0].status, result: result[0] ?? null });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json().catch(() => null) as { action?: unknown; matchId?: unknown } | null;
  if (typeof body?.matchId !== "string") return NextResponse.json({ error: "Match required." }, { status: 400 });
  if (body.action === "forfeit") {
    const result = await forfeitRbpMatch(body.matchId, user.id);
    if (!result.ok) return NextResponse.json({ error: "This ranked battle is no longer active." }, { status: 409 });
    return NextResponse.json(result);
  }
  if (body.action === "resolve") return NextResponse.json({ result: await resolveFinishedRbpMatch(body.matchId) });
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
