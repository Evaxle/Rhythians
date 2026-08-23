import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getAvatarUrl } from "@/lib/avatar";
import { getRankInfo } from "@/lib/ranks";
import { fetchRhythiaScores, findScoreForMap } from "@/lib/daily";
import { isBattleMode, playerCount, selectBattleMap, teamScore, rankedLoss } from "@/lib/battles";

function uid() { return crypto.randomUUID(); }

async function selectCasualMap(lowestRank: number, highestRank: number, mode: string, manualMapId?: string | null) {
  if (mode === "manual") {
    if (!manualMapId) throw new Error("A map is required for manual selection.");
    const map = await prisma.challengeMap.findFirst({ where: { id: manualMapId, status: { in: ["approved", "legacy"] } }, select: { id: true } });
    if (!map) throw new Error("The selected map is unavailable.");
    return map;
  }
  const rankIndex = mode === "highest" ? highestRank : mode === "middle" ? Math.floor((lowestRank + highestRank) / 2) : lowestRank;
  return selectBattleMap(rankIndex);
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { action?: unknown; mode?: unknown; matchType?: unknown; teamMode?: unknown; opponentId?: unknown; matchId?: unknown; casualMapMode?: unknown; mapId?: unknown } | null;
  const action = body?.action;
  if (action === "queue") {
    const mode = typeof body?.mode === "string" ? body.mode : "1v1";
    const matchType = body?.matchType === "ranked" ? "ranked" : "casual";
    const teamMode = matchType === "ranked" ? "regular" : body?.teamMode === "captains" ? "captains" : "regular";
    if (!isBattleMode(mode)) return NextResponse.json({ error: "Invalid mode." }, { status: 400 });
    const count = playerCount(mode) * 2;
    const rank = getRankInfo(user.rhp);
    const existing = await prisma.$queryRawUnsafe<any[]>(`SELECT bm.id,COUNT(bp.id)::int AS players FROM "BattleMatch" bm JOIN "BattleMatchPlayer" bp ON bp."matchId"=bm.id WHERE bm.status='queue' AND bm."matchType"=$1 AND bm.mode=$2 GROUP BY bm.id HAVING COUNT(bp.id) < $3 ORDER BY bm."createdAt" LIMIT 20`, matchType, `${mode}:${teamMode}`, count);
    for (const candidate of existing) {
      const members = await prisma.$queryRawUnsafe<any[]>(`SELECT u.rhp FROM "BattleMatchPlayer" bp JOIN "User" u ON u.id=bp."userId" WHERE bp."matchId"=$1`, candidate.id);
      const compatible = members.length > 0 && members.every((member) => { const memberRank = getRankInfo(member.rhp); return matchType === "ranked" ? memberRank.index === rank.index && memberRank.tier === rank.tier : memberRank.index === rank.index; });
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
    if (typeof body?.opponentId !== "string" || body.opponentId === user.id) return NextResponse.json({ error: "A different opponent is required." }, { status: 400 });
    const opponent = await prisma.user.findUnique({ where: { id: body.opponentId }, select: { id: true, rhp: true } });
    if (!opponent) return NextResponse.json({ error: "User not found." }, { status: 404 });
    const mode = typeof body?.mode === "string" ? body.mode : "1v1";
    const matchType = body?.matchType === "ranked" ? "ranked" : "casual";
    if (mode !== "1v1") return NextResponse.json({ error: "Direct challenges are only available for 1v1." }, { status: 400 });
    if (matchType === "ranked") { const a = getRankInfo(user.rhp); const b = getRankInfo(opponent.rhp); if (a.index !== b.index || a.tier !== b.tier) return NextResponse.json({ error: "Not matching ranks." }, { status: 400 }); }
    const casualMapMode = matchType === "casual" && ["lowest", "middle", "highest", "manual"].includes(String(body?.casualMapMode)) ? String(body?.casualMapMode) : "lowest";
    const manualMapId = matchType === "casual" && typeof body?.mapId === "string" ? body.mapId : null;
    if (casualMapMode === "manual" && !manualMapId) return NextResponse.json({ error: "Select a map for manual selection." }, { status: 400 });
    if (casualMapMode === "manual") { const selected = await prisma.challengeMap.findFirst({ where: { id: manualMapId!, status: { in: ["approved", "legacy"] } }, select: { id: true } }); if (!selected) return NextResponse.json({ error: "Selected map is unavailable." }, { status: 400 }); }
    const matchId = uid();
    await prisma.$executeRawUnsafe(`INSERT INTO "BattleMatch" ("id","matchType","mode","status","casualMapMode") VALUES ($1,$2,$3,'invite',$4)`, matchId, matchType, mode, casualMapMode);
    if (manualMapId) await prisma.$executeRawUnsafe(`UPDATE "BattleMatch" SET "mapId"=$2 WHERE id=$1`, matchId, manualMapId);
    await prisma.$executeRawUnsafe(`INSERT INTO "BattleMatchPlayer" ("id","matchId","userId","team") VALUES ($1,$2,$3,1),($4,$5,$6,2)`, uid(), matchId, user.id, uid(), matchId, opponent.id);
    await prisma.notification.create({ data: { userId: opponent.id, type: "announcement", title: "Battle request", message: `${user.displayName ?? user.username} invited you to a ${matchType} ${mode} battle.`, url: `/battles/match/${matchId}` } });
    return NextResponse.json({ matchId, status: "invite", casualMapMode });
  }
  if (action === "check-score") {
    if (typeof body?.matchId !== "string") return NextResponse.json({ error: "Match required." }, { status: 400 });
    const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT bm.*,bp."userId" FROM "BattleMatch" bm JOIN "BattleMatchPlayer" bp ON bp."matchId"=bm.id AND bp."userId"=$2 WHERE bm.id=$1`, body.matchId, user.id);
    if (!rows[0] || rows[0].status !== "active") return NextResponse.json({ error: "Active match not found." }, { status: 404 });
    if (!rows[0].mapId) return NextResponse.json({ error: "No battle map selected." }, { status: 400 });
    const map = await prisma.challengeMap.findUnique({ where: { id: rows[0].mapId }, select: { title: true } });
    const profile = await prisma.rhythiaProfile.findUnique({ where: { userId: user.id }, select: { profileId: true } });
    if (!map || !profile) return NextResponse.json({ error: "Link your Rhythia account first." }, { status: 403 });
    let recent; try { recent = (await fetchRhythiaScores(profile.profileId)).recent; } catch { return NextResponse.json({ error: "Could not retrieve recent Rhythia scores." }, { status: 502 }); }
    const score = findScoreForMap(recent, map.title);
    if (!score) return NextResponse.json({ error: "No matching recent Rhythia score was found for this battle map." }, { status: 400 });
    const accuracy = Number(score.accuracy);
    if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100) return NextResponse.json({ error: "The recent Rhythia score did not contain a valid accuracy." }, { status: 400 });
    await prisma.$executeRawUnsafe(`UPDATE "BattleMatchPlayer" SET "accuracy"=$3,"score"=$3,"scoreId"=$4,"checkedAt"=NOW() WHERE "matchId"=$1 AND "userId"=$2`, body.matchId, user.id, accuracy, String(score.id));
    const players = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "BattleMatchPlayer" WHERE "matchId"=$1`, body.matchId);
    const allScored = players.length > 0 && players.every((player) => player.accuracy != null);
    if (allScored) await finishMatch(body.matchId, rows[0].matchType, rows[0].mode);
    return NextResponse.json({ ok: true, finished: allScored });
  }
  if (action === "accept") {
    if (typeof body?.matchId !== "string") return NextResponse.json({ error: "Match required." }, { status: 400 });
    const row = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "BattleMatchPlayer" WHERE "matchId"=$1 AND "userId"=$2 AND team=2`, body.matchId, user.id);
    if (!row[0]) return NextResponse.json({ error: "Battle request not found." }, { status: 404 });
    const match = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "BattleMatch" WHERE id=$1 AND status='invite'`, body.matchId);
    if (!match[0]) return NextResponse.json({ error: "Battle request is no longer pending." }, { status: 400 });
    const creator = await prisma.$queryRawUnsafe<any[]>(`SELECT u.rhp FROM "BattleMatchPlayer" bp JOIN "User" u ON u.id=bp."userId" WHERE bp."matchId"=$1 AND bp.team=1`, body.matchId);
    if (!creator[0]) return NextResponse.json({ error: "Battle creator not found." }, { status: 404 });
    if (match[0].matchType === "ranked") { const a = getRankInfo(creator[0].rhp); const b = getRankInfo(user.rhp); if (a.index !== b.index || a.tier !== b.tier) return NextResponse.json({ error: "Not matching ranks." }, { status: 400 }); }
    const creatorRank = getRankInfo(creator[0].rhp).index;
    const opponentRank = getRankInfo(user.rhp).index;
    const mapRankIndex = match[0].matchType === "casual" ? Math.min(creatorRank, opponentRank) : creatorRank;
    await startMatch(body.matchId, mapRankIndex, match[0].matchType === "casual" ? match[0].casualMapMode : "lowest");
    return NextResponse.json({ ok: true, matchId: body.matchId, status: "active" });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const url = new URL(request.url);
  if (url.searchParams.get("history") === "1") {
    const matches = await prisma.$queryRawUnsafe<any[]>(`SELECT bm.id,bm."matchType",bm.mode,bm.status,bm."startedAt",bm."finishedAt",bm."createdAt",bm."mapId",bp.team,bp.accuracy,bp."userId",m.title AS "mapTitle",COUNT(*) OVER (PARTITION BY bm.id)::int AS "playerCount" FROM "BattleMatch" bm JOIN "BattleMatchPlayer" bp ON bp."matchId"=bm.id LEFT JOIN "ChallengeMap" m ON m.id=bm."mapId" WHERE bm.status='finished' AND bp."userId"=$1 ORDER BY bm."finishedAt" DESC NULLS LAST LIMIT 50`, user.id);
    return NextResponse.json({ matches: matches.map((match) => ({ ...match, mode: String(match.mode).split(":")[0], teamMode: String(match.mode).endsWith(":captains") ? "captains" : "regular" })) });
  }
  const matchId = url.searchParams.get("id");
  if (!matchId) return NextResponse.json({ error: "Match required." }, { status: 400 });
  const match = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "BattleMatch" WHERE id=$1`, matchId);
  if (!match[0]) return NextResponse.json({ error: "Match not found." }, { status: 404 });
  const players = await prisma.$queryRawUnsafe<any[]>(`SELECT bp.*,u.username,u."displayName",u."profileHandle",u.avatar,u."discordId",u.rhp,COALESCE((SELECT json_agg(json_build_object('name',t.name,'slug',t.slug) ORDER BY upt.position ASC) FROM "UserProfileTag" upt JOIN "UserTag" ut ON ut."userId"=u.id AND ut."tagId"=upt."tagId" JOIN "Tag" t ON t.id=ut."tagId" WHERE upt."userId"=u.id LIMIT 3),'[]'::json) AS tags FROM "BattleMatchPlayer" bp JOIN "User" u ON u.id=bp."userId" WHERE bp."matchId"=$1 ORDER BY bp.team,bp.id`, matchId);
  const normalizedPlayers = players.map((player) => ({ ...player, avatar: getAvatarUrl({ avatar: player.avatar, discordId: player.discordId }, 256) }));
  const map = match[0].mapId ? await prisma.challengeMap.findUnique({ where: { id: match[0].mapId }, select: { id: true, title: true, artist: true, length: true, mapFileUrl: true, imageUrl: true, rating: true } }) : null;
  const teamOne = normalizedPlayers.filter((player) => player.team === 1).map((player) => player.accuracy).filter((value) => value != null);
  const teamTwo = normalizedPlayers.filter((player) => player.team === 2).map((player) => player.accuracy).filter((value) => value != null);
  const teamMode = String(match[0].mode).endsWith(":captains") ? "captains" : "regular";
  const scoreOne = teamScore(teamOne, teamMode); const scoreTwo = teamScore(teamTwo, teamMode);
  const winner = scoreOne == null || scoreTwo == null ? null : scoreOne === scoreTwo ? 0 : scoreOne > scoreTwo ? 1 : 2;
  return NextResponse.json({ match: match[0], players: normalizedPlayers, map, viewerId: user.id, teamScores: { one: scoreOne, two: scoreTwo, winner } });
}

async function startMatch(matchId: string, rankIndex: number, casualMapMode = "lowest") {
  const players = await prisma.$queryRawUnsafe<Array<{ rhp: number }>>(`SELECT u.rhp FROM "BattleMatchPlayer" bp JOIN "User" u ON u.id=bp."userId" WHERE bp."matchId"=$1`, matchId);
  const rankIndexes = players.map((player) => getRankInfo(player.rhp).index);
  const lowest = rankIndexes.length ? Math.min(...rankIndexes) : rankIndex;
  const highest = rankIndexes.length ? Math.max(...rankIndexes) : rankIndex;
  const current = await prisma.$queryRawUnsafe<Array<{ mapId: string | null }>>(`SELECT "mapId" FROM "BattleMatch" WHERE id=$1`, matchId);
  let map = current[0]?.mapId ? { id: current[0].mapId } : null;
  if (!map) map = casualMapMode === "manual" ? null : await selectCasualMap(lowest, highest, casualMapMode);
  if (!map) return;
  await prisma.$executeRawUnsafe(`UPDATE "BattleMatch" SET status='active',"mapId"=$2,"startedAt"=NOW() WHERE id=$1 AND status IN ('queue','invite')`, matchId, map.id);
}

async function finishMatch(matchId: string, matchType: string, modeValue: string) {
  const players = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "BattleMatchPlayer" WHERE "matchId"=$1`); const mode = modeValue.includes(":") ? modeValue.split(":")[0] : modeValue; const teamMode = matchType === "ranked" ? "regular" : modeValue.endsWith(":captains") ? "captains" : "regular"; const scoreOne = teamScore(players.filter((p) => p.team === 1).map((p) => p.accuracy), teamMode); const scoreTwo = teamScore(players.filter((p) => p.team === 2).map((p) => p.accuracy), teamMode); if (scoreOne == null || scoreTwo == null) return; const winner = scoreOne === scoreTwo ? 0 : scoreOne > scoreTwo ? 1 : 2; await prisma.$executeRawUnsafe(`UPDATE "BattleMatch" SET status='finished',"finishedAt"=NOW() WHERE id=$1`, matchId); if (matchType !== "ranked" || !winner) return; const winningScore = Math.max(scoreOne, scoreTwo); const losingScore = Math.min(scoreOne, scoreTwo); const loss = rankedLoss(winningScore, losingScore); for (const player of players) { if (player.team === winner) { await prisma.$executeRawUnsafe(`UPDATE "User" SET rhp="rhp"+30,"updatedAt"=NOW() WHERE id=$1`, player.userId); await prisma.$executeRawUnsafe(`INSERT INTO "RhpTransaction" ("id","userId","amount","reason","description") VALUES ($1,$2,30,'battle_win',$3)`, uid(), player.userId, `${mode} ranked battle win`); } else { await prisma.$executeRawUnsafe(`UPDATE "User" SET rhp=GREATEST(0,"rhp"-$2),"updatedAt"=NOW() WHERE id=$1`, player.userId, loss); await prisma.$executeRawUnsafe(`INSERT INTO "RhpTransaction" ("id","userId","amount","reason","description") VALUES ($1,$2,$3,'battle_loss',$4)`, uid(), player.userId, -loss, `${mode} ranked battle loss`); } } }
