import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getRankInfo } from "@/lib/ranks";
import { isBattleMode, playerCount, selectBattleMap, teamScore, rankedLoss } from "@/lib/battles";

function uid() { return crypto.randomUUID(); }

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { action?: unknown; mode?: unknown; matchType?: unknown; teamMode?: unknown; opponentId?: unknown; matchId?: unknown; accuracy?: unknown; scoreId?: unknown } | null;
  const action = body?.action;
  if (action === "queue") {
    const mode = typeof body?.mode === "string" ? body.mode : "1v1";
    const matchType = body?.matchType === "ranked" ? "ranked" : "casual";
    const teamMode = body?.teamMode === "captains" ? "captains" : "regular";
    if (!isBattleMode(mode)) return NextResponse.json({ error: "Invalid mode." }, { status: 400 });
    const count = playerCount(mode) * 2;
    const rank = getRankInfo(user.rhp);
    const existing = await prisma.$queryRawUnsafe<any[]>(`SELECT bm.id,COUNT(bp.id)::int AS players FROM "BattleMatch" bm JOIN "BattleMatchPlayer" bp ON bp."matchId"=bm.id WHERE bm.status='queue' AND bm."matchType"=$1 AND bm.mode=$2 GROUP BY bm.id HAVING COUNT(bp.id) < $3 ORDER BY bm."createdAt" LIMIT 20`, matchType, mode, count);
    for (const candidate of existing) {
      const members = await prisma.$queryRawUnsafe<any[]>(`SELECT u.rhp FROM "BattleMatchPlayer" bp JOIN "User" u ON u.id=bp."userId" WHERE bp."matchId"=$1`, candidate.id);
      const compatible = members.length > 0 && members.every((member) => {
        const memberRank = getRankInfo(member.rhp);
        return matchType === "ranked" ? memberRank.index === rank.index && memberRank.tier === rank.tier : memberRank.index === rank.index;
      });
      if (!compatible) continue;
      await prisma.$executeRawUnsafe(`INSERT INTO "BattleMatchPlayer" ("id","matchId","userId","team") VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`, uid(), candidate.id, user.id, candidate.players % 2 === 0 ? 1 : 2);
      const total = await prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*)::int AS count FROM "BattleMatchPlayer" WHERE "matchId"=$1`, candidate.id);
      if (total[0].count >= count) await startMatch(candidate.id, rank.index);
      return NextResponse.json({ matchId: candidate.id, status: total[0].count >= count ? "active" : "queue" });
    }
    const matchId = uid();
    await prisma.$executeRawUnsafe(`INSERT INTO "BattleMatch" ("id","matchType","mode","status") VALUES ($1,$2,$3,'queue')`, matchId, matchType, `${mode}:${teamMode}`);
    await prisma.$executeRawUnsafe(`INSERT INTO "BattleMatchPlayer" ("id","matchId","userId","team") VALUES ($1,$2,$3,1)`, uid(), matchId, user.id);
    return NextResponse.json({ matchId, status: "queue" }, { status: 201 });
  }
  if (action === "invite") {
    if (typeof body?.opponentId !== "string") return NextResponse.json({ error: "Opponent required." }, { status: 400 });
    const opponent = await prisma.user.findUnique({ where: { id: body.opponentId }, select: { id: true, rhp: true } });
    if (!opponent) return NextResponse.json({ error: "User not found." }, { status: 404 });
    const mode = typeof body?.mode === "string" ? body.mode : "1v1";
    const matchType = body?.matchType === "ranked" ? "ranked" : "casual";
    if (!isBattleMode(mode)) return NextResponse.json({ error: "Invalid mode." }, { status: 400 });
    if (matchType === "ranked") {
      const a = getRankInfo(user.rhp); const b = getRankInfo(opponent.rhp);
      if (a.index !== b.index || a.tier !== b.tier) return NextResponse.json({ error: "Not matching ranks." }, { status: 400 });
    }
    const matchId = uid();
    await prisma.$executeRawUnsafe(`INSERT INTO "BattleMatch" ("id","matchType","mode","status") VALUES ($1,$2,$3,'invite')`, matchId, matchType, mode);
    await prisma.$executeRawUnsafe(`INSERT INTO "BattleMatchPlayer" ("id","matchId","userId","team") VALUES ($1,$2,$3,1),($4,$5,$6,2)`, uid(), matchId, user.id, uid(), matchId, opponent.id);
    await prisma.notification.create({ data: { userId: opponent.id, type: "announcement", title: "Battle request", message: `${user.displayName ?? user.username} invited you to a ${matchType} ${mode} battle.`, url: `/battles/match/${matchId}` } });
    return NextResponse.json({ matchId });
  }
  if (action === "check-score") {
    if (typeof body?.matchId !== "string" || typeof body?.accuracy !== "number") return NextResponse.json({ error: "Score data required." }, { status: 400 });
    const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT bm.* FROM "BattleMatch" bm JOIN "BattleMatchPlayer" bp ON bp."matchId"=bm.id AND bp."userId"=$2 WHERE bm.id=$1`, body.matchId, user.id);
    if (!rows[0]) return NextResponse.json({ error: "Match not found." }, { status: 404 });
    await prisma.$executeRawUnsafe(`UPDATE "BattleMatchPlayer" SET "accuracy"=$3,"score"=$3,"scoreId"=$4,"checkedAt"=NOW() WHERE "matchId"=$1 AND "userId"=$2`, body.matchId, user.id, body.accuracy, typeof body.scoreId === "string" ? body.scoreId : null);
    const players = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "BattleMatchPlayer" WHERE "matchId"=$1`, body.matchId);
    const allScored = players.length > 0 && players.every((player) => player.accuracy != null);
    if (allScored) await finishMatch(body.matchId, rows[0].matchType, rows[0].mode);
    return NextResponse.json({ ok: true, finished: allScored });
  }
  if (action === "accept") {
    if (typeof body?.matchId !== "string") return NextResponse.json({ error: "Match required." }, { status: 400 });
    const row = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "BattleMatchPlayer" WHERE "matchId"=$1 AND "userId"=$2`, body.matchId, user.id);
    if (!row[0]) return NextResponse.json({ error: "Battle request not found." }, { status: 404 });
    const match = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "BattleMatch" WHERE id=$1`, body.matchId);
    if (!match[0]) return NextResponse.json({ error: "Match not found." }, { status: 404 });
    await startMatch(body.matchId, getRankInfo(user.rhp).index);
    return NextResponse.json({ ok: true, matchId: body.matchId });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const matchId = new URL(request.url).searchParams.get("id");
  if (!matchId) return NextResponse.json({ error: "Match required." }, { status: 400 });
  const match = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "BattleMatch" WHERE id=$1`, matchId);
  if (!match[0]) return NextResponse.json({ error: "Match not found." }, { status: 404 });
  const players = await prisma.$queryRawUnsafe<any[]>(`SELECT bp.*,u.username,u."displayName",u."profileHandle",u.avatar,u.rhp FROM "BattleMatchPlayer" bp JOIN "User" u ON u.id=bp."userId" WHERE bp."matchId"=$1 ORDER BY bp.team,bp.id`, matchId);
  let map = null;
  if (match[0].mapId) map = await prisma.dailyMap.findUnique({ where: { id: match[0].mapId }, select: { id: true, title: true, artist: true, length: true, downloadUrl: true, imageUrl: true, starRating: true } });
  return NextResponse.json({ match: match[0], players, map });
}

async function startMatch(matchId: string, rankIndex: number) {
  const map = await selectBattleMap(rankIndex);
  await prisma.$executeRawUnsafe(`UPDATE "BattleMatch" SET status='active',"mapId"=$2,"startedAt"=NOW() WHERE id=$1`, matchId, map?.id ?? null);
}

async function finishMatch(matchId: string, matchType: string, modeValue: string) {
  const players = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "BattleMatchPlayer" WHERE "matchId"=$1`, matchId);
  const mode = modeValue.includes(":") ? modeValue.split(":")[0] : modeValue;
  const teamMode = modeValue.endsWith(":captains") ? "captains" : "regular";
  const scoreOne = teamScore(players.filter((p) => p.team === 1).map((p) => p.accuracy), teamMode);
  const scoreTwo = teamScore(players.filter((p) => p.team === 2).map((p) => p.accuracy), teamMode);
  if (scoreOne == null || scoreTwo == null) return;
  const winner = scoreOne === scoreTwo ? 0 : scoreOne > scoreTwo ? 1 : 2;
  await prisma.$executeRawUnsafe(`UPDATE "BattleMatch" SET status='finished',"finishedAt"=NOW() WHERE id=$1`, matchId);
  if (matchType !== "ranked" || !winner) return;
  for (const player of players) {
    if (player.team === winner) {
      await prisma.$executeRawUnsafe(`UPDATE "User" SET rhp="rhp"+30,"updatedAt"=NOW() WHERE id=$1`, player.userId);
      await prisma.$executeRawUnsafe(`INSERT INTO "RhpTransaction" ("id","userId","amount","reason","description") VALUES ($1,$2,30,'battle_win',$3)`, uid(), player.userId, `${mode} ranked battle win`);
    } else {
      const loss = rankedLoss(Math.max(scoreOne, scoreTwo), Math.min(scoreOne, scoreTwo));
      await prisma.$executeRawUnsafe(`UPDATE "User" SET rhp=GREATEST(0,"rhp"-$2),"updatedAt"=NOW() WHERE id=$1`, player.userId, loss);
      await prisma.$executeRawUnsafe(`INSERT INTO "RhpTransaction" ("id","userId","amount","reason","description") VALUES ($1,$2,$3,'battle_loss',$4)`, uid(), player.userId, -loss, `${mode} ranked battle loss`);
    }
  }
}
