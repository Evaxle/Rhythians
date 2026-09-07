import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getRankInfo } from "@/lib/ranks";
import { averageRankTier, rankIndexFromTierValue, selectBattleMap } from "@/lib/battles";

const allowedModes = new Set(["lowest", "middle", "highest", "manual"]);

async function getMatch(matchId: string, userId: string) {
  return (await prisma.$queryRawUnsafe<any[]>(`SELECT bm.id,bm.status,bm."matchType",bm."mapId",bm."casualMapMode" FROM "BattleMatch" bm JOIN "BattleMatchPlayer" bp ON bp."matchId"=bm.id WHERE bm.id=$1 AND bp."userId"=$2`, matchId, userId))[0] ?? null;
}

export async function GET(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { matchId } = await params;
  const match = await getMatch(matchId, user.id);
  if (!match || match.matchType !== "casual") return NextResponse.json({ error: "Casual battle not found." }, { status: 404 });
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  const maps = await prisma.challengeMap.findMany({
    where: {
      status: { in: ["approved", "legacy"] },
      ...(query ? { OR: [{ title: { contains: query, mode: "insensitive" } }, { artist: { contains: query, mode: "insensitive" } }] } : {}),
    },
    select: { id: true, title: true, artist: true, rating: true, length: true, imageUrl: true },
    orderBy: [{ rating: "asc" }, { title: "asc" }],
    take: 100,
  });
  return NextResponse.json({ maps });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { matchId } = await params;
  const body = await request.json().catch(() => null) as { mode?: unknown; mapId?: unknown } | null;
  const mode = typeof body?.mode === "string" && allowedModes.has(body.mode) ? body.mode : "lowest";
  const match = await getMatch(matchId, user.id);
  if (!match) return NextResponse.json({ error: "Match not found." }, { status: 404 });
  if (match.matchType !== "casual" || !["map_vote", "map_select"].includes(match.status)) return NextResponse.json({ error: "Map selection is only available before a casual battle starts." }, { status: 400 });

  let map: { id: string } | null = null;
  if (mode === "manual") {
    if (typeof body?.mapId !== "string") return NextResponse.json({ error: "Choose a custom map first." }, { status: 400 });
    map = await prisma.challengeMap.findFirst({ where: { id: body.mapId, status: { in: ["approved", "legacy"] } }, select: { id: true } });
    if (!map) return NextResponse.json({ error: "The selected map is unavailable." }, { status: 400 });
  } else {
    const players = await prisma.$queryRawUnsafe<Array<{ rhp: number }>>(`SELECT u.rhp FROM "BattleMatchPlayer" bp JOIN "User" u ON u.id=bp."userId" WHERE bp."matchId"=$1`, matchId);
    if (!players.length) return NextResponse.json({ error: "Battle players not found." }, { status: 400 });
    const ranks = players.map((player) => getRankInfo(Number(player.rhp)).index);
    const lowest = Math.min(...ranks);
    const highest = Math.max(...ranks);
    const middle = rankIndexFromTierValue(averageRankTier(players.map((player) => Number(player.rhp))));
    const rankIndex = mode === "highest" ? highest : mode === "middle" ? middle : lowest;
    map = await selectBattleMap(rankIndex);
    if (!map) return NextResponse.json({ error: "No battle map is available for that rank range." }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`UPDATE "BattleMatch" SET status='map_vote',"casualMapMode"=$2,"mapId"=$3,"startedAt"=NULL,"responseDeadlineAt"=NULL WHERE id=$1 AND status IN ('map_vote','map_select')`, matchId, mode, map.id);
    await tx.$executeRawUnsafe(`UPDATE "BattleMatchPlayer" SET "readyAt"=NULL WHERE "matchId"=$1`, matchId);
    await tx.$executeRawUnsafe(`DELETE FROM "BattleMatchMapLike" WHERE "matchId"=$1`, matchId);
    await tx.$executeRawUnsafe(`DELETE FROM "BattleMatchMapVote" WHERE "matchId"=$1`, matchId);
  });
  return NextResponse.json({ ok: true, mode, mapId: map.id });
}
