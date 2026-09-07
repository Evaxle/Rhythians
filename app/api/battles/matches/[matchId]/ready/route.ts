import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function POST(_request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { matchId } = await params;
  const match = (await prisma.$queryRawUnsafe<any[]>(`SELECT bm.id,bm.status,bm."matchType",bm."mapId" FROM "BattleMatch" bm JOIN "BattleMatchPlayer" bp ON bp."matchId"=bm.id WHERE bm.id=$1 AND bp."userId"=$2`, matchId, user.id))[0];
  if (!match || !["map_vote", "map_select", "active"].includes(match.status)) return NextResponse.json({ error: "This battle cannot be readied." }, { status: 400 });
  if (!match.mapId) return NextResponse.json({ error: match.matchType === "casual" ? "Select a map before readying." : "The ranked map has not been selected yet." }, { status: 400 });

  await prisma.$executeRawUnsafe(`UPDATE "BattleMatchPlayer" SET "readyAt"=CURRENT_TIMESTAMP,"lastSeenAt"=CURRENT_TIMESTAMP WHERE "matchId"=$1 AND "userId"=$2`, matchId, user.id);
  const counts = (await prisma.$queryRawUnsafe<Array<{ total: number; ready: number }>>(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER (WHERE "readyAt" IS NOT NULL)::int AS ready FROM "BattleMatchPlayer" WHERE "matchId"=$1`, matchId))[0];
  const allReady = Number(counts?.total ?? 0) > 0 && Number(counts?.ready ?? 0) === Number(counts?.total ?? 0);
  if (allReady) {
    await prisma.$executeRawUnsafe(`UPDATE "BattleMatch" SET status='active',"startedAt"=CURRENT_TIMESTAMP,"responseDeadlineAt"=NULL WHERE id=$1 AND "mapId" IS NOT NULL`, matchId);
  }
  return NextResponse.json({ ok: true, ready: Number(counts?.ready ?? 0), total: Number(counts?.total ?? 0), allReady });
}
