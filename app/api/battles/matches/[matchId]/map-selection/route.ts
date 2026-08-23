import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { matchId } = await params;
  const body = await request.json().catch(() => null) as { mode?: unknown; mapId?: unknown } | null;
  const mode = typeof body?.mode === "string" && ["lowest", "middle", "highest", "manual"].includes(body.mode) ? body.mode : "lowest";
  const match = await prisma.$queryRawUnsafe<any[]>(`SELECT bm.id,bm.status,bm."matchType",bm."mapId",bp."userId",bp.team FROM "BattleMatch" bm JOIN "BattleMatchPlayer" bp ON bp."matchId"=bm.id WHERE bm.id=$1 AND bp."userId"=$2`, matchId, user.id);
  if (!match[0]) return NextResponse.json({ error: "Match not found." }, { status: 404 });
  if (match[0].matchType !== "casual" || match[0].status !== "queue") return NextResponse.json({ error: "Map selection is only available while a casual match is waiting." }, { status: 400 });
  if (match[0].team !== 1) return NextResponse.json({ error: "Only the first player in the queue can choose the map pool." }, { status: 403 });
  if (mode === "manual") {
    if (typeof body?.mapId !== "string") return NextResponse.json({ error: "A map is required for manual selection." }, { status: 400 });
    const map = await prisma.challengeMap.findFirst({ where: { id: body.mapId, status: { in: ["approved", "legacy"] } }, select: { id: true } });
    if (!map) return NextResponse.json({ error: "The selected map is unavailable." }, { status: 400 });
    await prisma.$executeRawUnsafe(`UPDATE "BattleMatch" SET "casualMapMode"=$2,"mapId"=$3 WHERE id=$1 AND status='queue'`, matchId, mode, map.id);
    return NextResponse.json({ ok: true, mode, mapId: map.id });
  }
  await prisma.$executeRawUnsafe(`UPDATE "BattleMatch" SET "casualMapMode"=$2,"mapId"=NULL WHERE id=$1 AND status='queue'`, matchId, mode);
  return NextResponse.json({ ok: true, mode, mapId: null });
}
