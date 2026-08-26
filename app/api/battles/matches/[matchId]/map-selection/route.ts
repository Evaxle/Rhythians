import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getRankInfo } from "@/lib/ranks";
import { selectBattleMap } from "@/lib/battles";

export async function PATCH(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { matchId } = await params;
  const body = await request.json().catch(() => null) as { mode?: unknown; mapId?: unknown } | null;
  const mode = typeof body?.mode === "string" && ["lowest", "middle", "highest", "manual"].includes(body.mode) ? body.mode : "lowest";
  const match = await prisma.$queryRawUnsafe<any[]>(`SELECT bm.id,bm.status,bm."matchType",bm."mapId",bp."userId",bp.team FROM "BattleMatch" bm JOIN "BattleMatchPlayer" bp ON bp."matchId"=bm.id WHERE bm.id=$1 AND bp."userId"=$2`, matchId, user.id);
  if (!match[0]) return NextResponse.json({ error: "Match not found." }, { status: 404 });
  if (match[0].matchType !== "casual" || match[0].status !== "map_select") return NextResponse.json({ error: "Map selection is only available after both players enter a casual match." }, { status: 400 });
  if (mode === "manual") {
    if (typeof body?.mapId !== "string") return NextResponse.json({ error: "A map is required for manual selection." }, { status: 400 });
    const map = await prisma.challengeMap.findFirst({ where: { id: body.mapId, status: { in: ["approved", "legacy"] } }, select: { id: true } });
    if (!map) return NextResponse.json({ error: "The selected map is unavailable." }, { status: 400 });
    await prisma.$executeRawUnsafe(`UPDATE "BattleMatch" SET "casualMapMode"=$2,"mapId"=$3 WHERE id=$1 AND status='map_select'`, matchId, mode, map.id);
    await prisma.$executeRawUnsafe(`DELETE FROM "BattleMatchMapLike" WHERE "matchId"=$1`, matchId);
    return NextResponse.json({ ok: true, mode, mapId: map.id });
  }
  const players = await prisma.$queryRawUnsafe<Array<{ rhp: number }>>(`SELECT u.rhp FROM "BattleMatchPlayer" bp JOIN "User" u ON u.id=bp."userId" WHERE bp."matchId"=$1`, matchId);
  if (!players.length) return NextResponse.json({ error: "Battle players not found." }, { status: 400 });
  const ranks = players.map((player) => getRankInfo(player.rhp).index);
  const lowest = Math.min(...ranks);
  const highest = Math.max(...ranks);
  const rankIndex = mode === "highest" ? highest : mode === "middle" ? Math.floor((lowest + highest) / 2) : lowest;
  const map = await selectBattleMap(rankIndex);
  await prisma.$executeRawUnsafe(`UPDATE "BattleMatch" SET "casualMapMode"=$2,"mapId"=$3 WHERE id=$1 AND status='map_select'`, matchId, mode, map.id);
  await prisma.$executeRawUnsafe(`DELETE FROM "BattleMatchMapLike" WHERE "matchId"=$1`, matchId);
  return NextResponse.json({ ok: true, mode, mapId: map.id });
}
