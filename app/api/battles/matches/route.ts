import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getAvatarUrl } from "@/lib/avatar";
import { getRankInfo } from "@/lib/ranks";
import { fetchRhythiaScores, findScoreForMap } from "@/lib/daily";
import { getCurrentRbpSeason, ensureUserRbpSeason, grantRbpSubmitBonus, resolveFinishedRbpMatch, forfeitRbpMatch } from "@/lib/rbp";
import { casualRanksCompatible, averageRankTier, rankIndexFromTierValue, isBattleMode, playerCount, selectBattleMap, teamScore } from "@/lib/battles";

const uid = () => randomUUID();
const RESPONSE_WINDOW_MS = 15 * 60 * 1000;
const RECONNECT_WINDOW_MS = 60 * 1000;

async function getPlayers(matchId: string) {
  return prisma.$queryRawUnsafe<any[]>(`SELECT bp.*,u.username,u."displayName",u."profileHandle",u.avatar,u."discordId",u.rhp FROM "BattleMatchPlayer" bp JOIN "User" u ON u.id=bp."userId" WHERE bp."matchId"=$1 ORDER BY bp.team,bp.id`, matchId);
}

async function initializeRankedPlayers(matchId: string) {
  for (const player of await getPlayers(matchId)) await ensureUserRbpSeason(player.userId);
}

async function createCasualOptions(matchId: string) {
  const players = await getPlayers(matchId);
  const rhps = players.map((player) => Number(player.rhp));
  const ranks = rhps.map((rhp) => getRankInfo(rhp).index);
  const lowest = ranks.length ? Math.min(...ranks) : 0;
  const highest = ranks.length ? Math.max(...ranks) : lowest;
  const average = rankIndexFromTierValue(averageRankTier(rhps));
  const targets: Array<[string, number]> = [["lower", lowest], ["middle", average], ["higher", highest]];
  const used: string[] = [];
  for (const [bucket, rankIndex] of targets) {
    const map = await selectBattleMap(rankIndex, null, used);
    if (!map) throw new Error("No battle maps are available for this matchup.");
    used.push(String(map.id));
    await prisma.$executeRawUnsafe(`INSERT INTO "BattleMatchMapOption" ("id","matchId","mapId","bucket") VALUES ($1,$2,$3,$4) ON CONFLICT ("matchId","bucket") DO UPDATE SET "mapId"=EXCLUDED."mapId"`, uid(), matchId, map.id, bucket);
  }
  await prisma.$executeRawUnsafe(`UPDATE "BattleMatch" SET status='map_vote',"casualMapMode"='vote' WHERE id=$1 AND status IN ('queue','invite')`, matchId);
}

async function startRankedMatch(matchId: string) {
  const players = await getPlayers(matchId);
  if (!players.length) throw new Error("Battle players not found.");
  const map = await selectBattleMap(rankIndexFromTierValue(averageRankTier(players.map((player) => Number(player.rhp)))), 240);
  if (!map) throw new Error("No ranked battle maps are available for this rank.");
  await initializeRankedPlayers(matchId);
  await prisma.$executeRawUnsafe(`UPDATE "BattleMatch" SET status='active',"mapId"=$2,"startedAt"=CURRENT_TIMESTAMP,"responseDeadlineAt"=NULL WHERE id=$1 AND status IN ('queue','invite')`, matchId, map.id);
}

async function compatible(matchType: string, rhps: number[]) {
  if (!rhps.length) return false;
  if (matchType === "ranked") {
    const ranks = rhps.map((rhp) => getRankInfo(rhp).index);
    return ranks.every((rank) => rank === ranks[0]);
  }
  return casualRanksCompatible(rhps);
}

async function resolveExpiredMatch(matchId: string) {
  const match = (await prisma.$queryRawUnsafe<any[]>(`SELECT id,status,"matchType",mode,"responseDeadlineAt" FROM "BattleMatch" WHERE id=$1`, matchId))[0];
  if (!match || match.status !== "active" || !match.responseDeadlineAt || new Date(match.responseDeadlineAt).getTime() > Date.now()) return;
  const players = await getPlayers(matchId);
  const teamMode = match.matchType === "ranked" ? "regular" : String(match.mode).endsWith(":captains") ? "captains" : "regular";
  const scoreOne = teamScore(players.filter((player) => player.team === 1 && player.accuracy != null).map((player) => Number(player.accuracy)), teamMode);
  const scoreTwo = teamScore(players.filter((player) => player.team === 2 && player.accuracy != null).map((player) => Number(player.accuracy)), teamMode);
  if (scoreOne == null && scoreTwo == null) return;
  const winnerTeam = scoreOne == null ? 2 : scoreTwo == null ? 1 : scoreOne === scoreTwo ? 0 : scoreOne > scoreTwo ? 1 : 2;
  await prisma.$executeRawUnsafe(`UPDATE "BattleMatch" SET status='finished',"finishedAt"=CURRENT_TIMESTAMP,"responseDeadlineAt"=NULL WHERE id=$1 AND status='active'`, matchId);
  if (match.matchType === "ranked") await resolveFinishedRbpMatch(matchId, winnerTeam, "timeout");
}

async function finishScoredMatch(matchId: string) {
  const match = (await prisma.$queryRawUnsafe<any[]>(`SELECT id,"matchType",mode,status FROM "BattleMatch" WHERE id=$1`, matchId))[0];
  if (!match || match.status !== "active") return;
  const players = await getPlayers(matchId);
  if (!players.length || players.some((player) => player.accuracy == null)) return;
  const teamMode = match.matchType === "ranked" ? "regular" : String(match.mode).endsWith(":captains") ? "captains" : "regular";
  const scoreOne = teamScore(players.filter((player) => player.team === 1).map((player) => Number(player.accuracy)), teamMode);
  const scoreTwo = teamScore(players.filter((player) => player.team === 2).map((player) => Number(player.accuracy)), teamMode);
  if (scoreOne == null || scoreTwo == null) return;
  const winnerTeam = scoreOne === scoreTwo ? 0 : scoreOne > scoreTwo ? 1 : 2;
  await prisma.$executeRawUnsafe(`UPDATE "BattleMatch" SET status='finished',"finishedAt"=CURRENT_TIMESTAMP,"responseDeadlineAt"=NULL WHERE id=$1 AND status='active'`, matchId);
  if (match.matchType !== "ranked") return;
  await resolveFinishedRbpMatch(matchId, winnerTeam, null);
  for (const player of players) {
    if (winnerTeam !== 0 && player.team === winnerTeam) {
      await prisma.$executeRawUnsafe(`UPDATE "User" SET rhp="rhp"+30,"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1`, player.userId);
      await prisma.$executeRawUnsafe(`INSERT INTO "RhpTransaction" ("id","userId","amount","reason","description") VALUES ($1,$2,30,'battle_win',$3)`, uid(), player.userId, `${String(match.mode).split(":")[0]} ranked battle win`);
    } else if (winnerTeam !== 0) {
      await prisma.$executeRawUnsafe(`UPDATE "User" SET rhp=GREATEST(0,"rhp"-20),"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1`, player.userId);
      await prisma.$executeRawUnsafe(`INSERT INTO "RhpTransaction" ("id","userId","amount","reason","description") VALUES ($1,$2,-20,'battle_loss',$3)`, uid(), player.userId, `${String(match.mode).split(":")[0]} ranked battle loss`);
    }
  }
}

async function forfeitBattle(matchId: string, userId: string) {
  const match = (await prisma.$queryRawUnsafe<any[]>(`SELECT id,"matchType",status FROM "BattleMatch" WHERE id=$1`, matchId))[0];
  if (!match || match.status !== "active") return { ok: false };
  const member = (await prisma.$queryRawUnsafe<any[]>(`SELECT 1 FROM "BattleMatchPlayer" WHERE "matchId"=$1 AND "userId"=$2`, matchId, userId))[0];
  if (!member) return { ok: false };
  if (match.matchType === "ranked") return forfeitRbpMatch(matchId, userId);
  const updated = await prisma.$executeRawUnsafe(`UPDATE "BattleMatch" SET status='finished',"finishedAt"=CURRENT_TIMESTAMP,"responseDeadlineAt"=NULL WHERE id=$1 AND status='active'`, matchId);
  return { ok: updated > 0, delta: 0 };
}

async function loadMatch(matchId: string, viewerId: string) {
  await resolveExpiredMatch(matchId);
  const match = (await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "BattleMatch" WHERE id=$1`, matchId))[0];
  if (!match) return null;
  const member = (await prisma.$queryRawUnsafe<any[]>(`SELECT 1 FROM "BattleMatchPlayer" WHERE "matchId"=$1 AND "userId"=$2`, matchId, viewerId))[0];
  if (!member) return null;
  const players = await getPlayers(matchId);
  const normalizedPlayers = players.map((player) => ({ ...player, avatar: getAvatarUrl({ avatar: player.avatar, discordId: player.discordId }, 256), rank: getRankInfo(Number(player.rhp)) }));
  const map = match.mapId ? await prisma.challengeMap.findUnique({ where: { id: match.mapId }, select: { id: true, title: true, artist: true, length: true, mapFileUrl: true, imageUrl: true, rating: true } }) : null;
  const options = await prisma.$queryRawUnsafe<any[]>(`SELECT o.id,o.mapId,o.bucket,m.title,m.artist,m.rating,m.length,m."mapFileUrl",m."imageUrl" FROM "BattleMatchMapOption" o JOIN "ChallengeMap" m ON m.id=o."mapId" WHERE o."matchId"=$1 ORDER BY CASE o.bucket WHEN 'lower' THEN 1 WHEN 'middle' THEN 2 ELSE 3 END`, matchId);
  const votes = await prisma.$queryRawUnsafe<any[]>(`SELECT "userId","mapId" FROM "BattleMatchMapVote" WHERE "matchId"=$1`, matchId);
  const teamMode = match.matchType === "ranked" ? "regular" : String(match.mode).endsWith(":captains") ? "captains" : "regular";
  const scoreOne = teamScore(normalizedPlayers.filter((player) => player.team === 1).map((player) => player.accuracy), teamMode);
  const scoreTwo = teamScore(normalizedPlayers.filter((player) => player.team === 2).map((player) => player.accuracy), teamMode);
  const winner = match.status === "finished" ? (scoreOne == null ? (scoreTwo == null ? 0 : 2) : scoreTwo == null ? 1 : scoreOne === scoreTwo ? 0 : scoreOne > scoreTwo ? 1 : 2) : null;
  const disconnected = normalizedPlayers.filter((player) => player.disconnectedAt && player.reconnectUntilAt && new Date(player.reconnectUntilAt).getTime() > Date.now()).map((player) => ({ userId: player.userId, until: player.reconnectUntilAt }));
  const rbpResult = match.status === "finished" && match.matchType === "ranked" ? await prisma.$queryRawUnsafe<any[]>(`SELECT "userId",result,delta,reason FROM "RbpMatchResult" WHERE "matchId"=$1`, matchId) : [];
  const rbpAwards = match.matchType === "ranked" ? await prisma.$queryRawUnsafe<any[]>(`SELECT "userId",kind,delta FROM "RbpMatchAward" WHERE "matchId"=$1`, matchId) : [];
  return { match, players: normalizedPlayers, viewerId, map, options, votes, teamScores: { one: scoreOne, two: scoreTwo, winner }, disconnected, rbpResult, rbpAwards };
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { action?: unknown; mode?: unknown; matchType?: unknown; teamMode?: unknown; opponentId?: unknown; matchId?: unknown; mapId?: unknown } | null;
  const action = body?.action;

  if (action === "queue") {
    const mode = typeof body?.mode === "string" ? body.mode : "1v1";
    const matchType = body?.matchType === "ranked" ? "ranked" : "casual";
    const teamMode = matchType === "ranked" ? "regular" : body?.teamMode === "captains" ? "captains" : "regular";
    if (!isBattleMode(mode)) return NextResponse.json({ error: "Invalid mode." }, { status: 400 });
    const existingUserMatch = (await prisma.$queryRawUnsafe<any[]>(`SELECT bm.id,bm.status FROM "BattleMatch" bm JOIN "BattleMatchPlayer" bp ON bp."matchId"=bm.id WHERE bp."userId"=$1 AND bm.status IN ('queue','map_vote','active') ORDER BY bm."createdAt" DESC LIMIT 1`, user.id))[0];
    if (existingUserMatch) return NextResponse.json({ matchId: existingUserMatch.id, status: existingUserMatch.status === "queue" ? "finding" : existingUserMatch.status });
    const count = playerCount(mode) * 2;
    const candidates = await prisma.$queryRawUnsafe<any[]>(`SELECT bm.id,COUNT(bp.id)::int AS players FROM "BattleMatch" bm JOIN "BattleMatchPlayer" bp ON bp."matchId"=bm.id WHERE bm.status='queue' AND bm."matchType"=$1 AND bm.mode=$2 GROUP BY bm.id HAVING COUNT(bp.id) < $3 ORDER BY bm."createdAt" ASC LIMIT 50`, matchType, `${mode}:${teamMode}`, count);
    for (const candidate of candidates) {
      const members = await prisma.$queryRawUnsafe<Array<{ rhp: number }>>(`SELECT u.rhp FROM "BattleMatchPlayer" bp JOIN "User" u ON u.id=bp."userId" WHERE bp."matchId"=$1`, candidate.id);
      if (!(await compatible(matchType, [...members.map((member) => Number(member.rhp)), Number(user.rhp)]))) continue;
      await prisma.$executeRawUnsafe(`INSERT INTO "BattleMatchPlayer" ("id","matchId","userId","team","lastSeenAt") VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING`, uid(), candidate.id, user.id, Number(candidate.players) % 2 === 0 ? 1 : 2);
      const total = Number((await prisma.$queryRawUnsafe<Array<{ count: number }>>(`SELECT COUNT(*)::int AS count FROM "BattleMatchPlayer" WHERE "matchId"=$1`, candidate.id))[0]?.count ?? 0);
      if (total >= count) {
        if (matchType === "casual") await createCasualOptions(candidate.id);
        else await startRankedMatch(candidate.id);
      }
      return NextResponse.json({ matchId: candidate.id, status: total >= count ? matchType === "casual" ? "map_vote" : "active" : "finding" });
    }
    const matchId = uid();
    await prisma.$executeRawUnsafe(`INSERT INTO "BattleMatch" ("id","matchType","mode","status","casualMapMode") VALUES ($1,$2,$3,'queue','finding')`, matchId, matchType, `${mode}:${teamMode}`);
    await prisma.$executeRawUnsafe(`INSERT INTO "BattleMatchPlayer" ("id","matchId","userId","team","lastSeenAt") VALUES ($1,$2,$3,1,CURRENT_TIMESTAMP)`, uid(), matchId, user.id);
    if (matchType === "ranked") await ensureUserRbpSeason(user.id);
    return NextResponse.json({ matchId, status: "finding" }, { status: 201 });
  }

  if (action === "invite") {
    if (typeof body?.opponentId !== "string" || body.opponentId === user.id) return NextResponse.json({ error: "A different opponent is required." }, { status: 400 });
    const opponent = await prisma.user.findUnique({ where: { id: body.opponentId }, select: { id: true, rhp: true } });
    if (!opponent) return NextResponse.json({ error: "User not found." }, { status: 404 });
    const mode = typeof body?.mode === "string" ? body.mode : "1v1";
    const matchType = body?.matchType === "ranked" ? "ranked" : "casual";
    if (mode !== "1v1") return NextResponse.json({ error: "Direct challenges are only available for 1v1." }, { status: 400 });
    const a = getRankInfo(user.rhp);
    const b = getRankInfo(opponent.rhp);
    if (matchType === "ranked" && a.index !== b.index) return NextResponse.json({ error: "Players must be in the same rank." }, { status: 400 });
    if (matchType === "casual" && Math.abs(a.index - b.index) > 1) return NextResponse.json({ error: "Casual opponents can be at most one rank apart." }, { status: 400 });
    const matchId = uid();
    await prisma.$executeRawUnsafe(`INSERT INTO "BattleMatch" ("id","matchType","mode","status","casualMapMode") VALUES ($1,$2,$3,'invite','finding')`, matchId, matchType, mode);
    await prisma.$executeRawUnsafe(`INSERT INTO "BattleMatchPlayer" ("id","matchId","userId","team","lastSeenAt") VALUES ($1,$2,$3,1,CURRENT_TIMESTAMP),($4,$5,$6,2,CURRENT_TIMESTAMP)`, uid(), matchId, user.id, uid(), matchId, opponent.id);
    if (matchType === "ranked") await initializeRankedPlayers(matchId);
    await prisma.notification.create({ data: { userId: opponent.id, type: "announcement", title: "Battle request", message: `${user.displayName ?? user.username} invited you to a ${matchType} ${mode} battle.`, url: `/battles/match/${matchId}` } });
    return NextResponse.json({ matchId, status: "invite" });
  }

  if (action === "accept") {
    if (typeof body?.matchId !== "string") return NextResponse.json({ error: "Match required." }, { status: 400 });
    const match = (await prisma.$queryRawUnsafe<any[]>(`SELECT id,status,"matchType",mode FROM "BattleMatch" WHERE id=$1`, body.matchId))[0];
    const member = (await prisma.$queryRawUnsafe<any[]>(`SELECT team FROM "BattleMatchPlayer" WHERE "matchId"=$1 AND "userId"=$2`, body.matchId, user.id))[0];
    if (!match || match.status !== "invite" || !member || member.team !== 2) return NextResponse.json({ error: "Battle request is no longer pending." }, { status: 400 });
    const players = await getPlayers(body.matchId);
    const a = getRankInfo(Number(players.find((player) => player.team === 1)?.rhp ?? 0));
    const b = getRankInfo(Number(user.rhp));
    if (match.matchType === "ranked" && a.index !== b.index) return NextResponse.json({ error: "Players must be in the same rank." }, { status: 400 });
    if (match.matchType === "casual" && Math.abs(a.index - b.index) > 1) return NextResponse.json({ error: "Casual opponents can be at most one rank apart." }, { status: 400 });
    if (match.matchType === "casual") await createCasualOptions(body.matchId);
    else await startRankedMatch(body.matchId);
    return NextResponse.json({ ok: true, matchId: body.matchId, status: match.matchType === "casual" ? "map_vote" : "active" });
  }

  if (action === "vote-map") {
    if (typeof body?.matchId !== "string" || typeof body?.mapId !== "string") return NextResponse.json({ error: "Match and map are required." }, { status: 400 });
    const match = (await prisma.$queryRawUnsafe<any[]>(`SELECT id,status,"matchType" FROM "BattleMatch" WHERE id=$1`, body.matchId))[0];
    if (!match || match.matchType !== "casual" || match.status !== "map_vote") return NextResponse.json({ error: "Map voting is unavailable." }, { status: 400 });
    const member = (await prisma.$queryRawUnsafe<any[]>(`SELECT 1 FROM "BattleMatchPlayer" WHERE "matchId"=$1 AND "userId"=$2`, body.matchId, user.id))[0];
    const option = (await prisma.$queryRawUnsafe<any[]>(`SELECT 1 FROM "BattleMatchMapOption" WHERE "matchId"=$1 AND "mapId"=$2`, body.matchId, body.mapId))[0];
    if (!member || !option) return NextResponse.json({ error: "You cannot vote for that map." }, { status: 403 });
    await prisma.$executeRawUnsafe(`INSERT INTO "BattleMatchMapVote" ("id","matchId","userId","mapId") VALUES ($1,$2,$3,$4) ON CONFLICT ("matchId","userId") DO UPDATE SET "mapId"=EXCLUDED."mapId","createdAt"=CURRENT_TIMESTAMP`, uid(), body.matchId, user.id, body.mapId);
    const playerCountRows = await prisma.$queryRawUnsafe<Array<{ count: number }>>(`SELECT COUNT(*)::int AS count FROM "BattleMatchPlayer" WHERE "matchId"=$1`, body.matchId);
    const voteCountRows = await prisma.$queryRawUnsafe<Array<{ count: number }>>(`SELECT COUNT(*)::int AS count FROM "BattleMatchMapVote" WHERE "matchId"=$1`, body.matchId);
    const done = Number(voteCountRows[0]?.count ?? 0) >= Number(playerCountRows[0]?.count ?? 0) && Number(playerCountRows[0]?.count ?? 0) > 0;
    let selectedMapId: string | null = null;
    if (done) {
      const votes = await prisma.$queryRawUnsafe<Array<{ mapId: string; count: number }>>(`SELECT "mapId",COUNT(*)::int AS count FROM "BattleMatchMapVote" WHERE "matchId"=$1 GROUP BY "mapId"`, body.matchId);
      const highest = Math.max(...votes.map((vote) => Number(vote.count)));
      const tied = votes.filter((vote) => Number(vote.count) === highest).map((vote) => vote.mapId);
      selectedMapId = tied[Math.floor(Math.random() * tied.length)] ?? null;
      if (selectedMapId) await prisma.$executeRawUnsafe(`UPDATE "BattleMatch" SET status='active',"mapId"=$2,"startedAt"=CURRENT_TIMESTAMP,"responseDeadlineAt"=NULL WHERE id=$1 AND status='map_vote'`, body.matchId, selectedMapId);
    }
    return NextResponse.json({ ok: true, finished: done, selectedMapId });
  }

  if (action === "check-score") {
    if (typeof body?.matchId !== "string") return NextResponse.json({ error: "Match required." }, { status: 400 });
    await resolveExpiredMatch(body.matchId);
    const row = (await prisma.$queryRawUnsafe<any[]>(`SELECT bm.*,bp."userId",bp.accuracy FROM "BattleMatch" bm JOIN "BattleMatchPlayer" bp ON bp."matchId"=bm.id AND bp."userId"=$2 WHERE bm.id=$1`, body.matchId, user.id))[0];
    if (!row || row.status !== "active") return NextResponse.json({ error: "Active match not found." }, { status: 404 });
    if (row.accuracy != null) return NextResponse.json({ ok: true, alreadySubmitted: true });
    if (row.responseDeadlineAt && new Date(row.responseDeadlineAt).getTime() <= Date.now()) return NextResponse.json({ error: "The response window has ended." }, { status: 409 });
    if (!row.mapId) return NextResponse.json({ error: "No battle map selected." }, { status: 400 });
    const map = await prisma.challengeMap.findUnique({ where: { id: row.mapId }, select: { title: true } });
    const profile = await prisma.rhythiaProfile.findUnique({ where: { userId: user.id }, select: { profileId: true } });
    if (!map || !profile) return NextResponse.json({ error: "Link your Rhythia account first." }, { status: 403 });
    let recent;
    try { recent = (await fetchRhythiaScores(profile.profileId)).recent; } catch { return NextResponse.json({ error: "Could not retrieve recent Rhythia scores." }, { status: 502 }); }
    const score = findScoreForMap(recent, map.title);
    if (!score) return NextResponse.json({ error: "No matching recent Rhythia score was found for this battle map." }, { status: 400 });
    const accuracy = Number(score.accuracy);
    if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100) return NextResponse.json({ error: "The recent Rhythia score did not contain a valid accuracy." }, { status: 400 });
    const deadline = row.responseDeadlineAt ? new Date(row.responseDeadlineAt).toISOString() : new Date(Date.now() + RESPONSE_WINDOW_MS).toISOString();
    await prisma.$executeRawUnsafe(`UPDATE "BattleMatchPlayer" SET "accuracy"=$3,"score"=$3,"scoreId"=$4,"checkedAt"=CURRENT_TIMESTAMP,"scoreSubmittedAt"=CURRENT_TIMESTAMP,"lastSeenAt"=CURRENT_TIMESTAMP,"disconnectedAt"=NULL,"reconnectUntilAt"=NULL WHERE "matchId"=$1 AND "userId"=$2 AND "accuracy" IS NULL`, body.matchId, user.id, accuracy, String(score.id));
    await prisma.$executeRawUnsafe(`UPDATE "BattleMatch" SET "responseDeadlineAt"=COALESCE("responseDeadlineAt",$2) WHERE id=$1 AND status='active'`, body.matchId, deadline);
    if ((await prisma.$queryRawUnsafe<any[]>(`SELECT "matchType" FROM "BattleMatch" WHERE id=$1`, body.matchId))[0]?.matchType === "ranked") {
      await ensureUserRbpSeason(user.id);
      await grantRbpSubmitBonus(body.matchId, user.id);
    }
    await finishScoredMatch(body.matchId);
    const status = (await prisma.$queryRawUnsafe<any[]>(`SELECT status FROM "BattleMatch" WHERE id=$1`, body.matchId))[0]?.status;
    return NextResponse.json({ ok: true, finished: status === "finished" });
  }

  if (action === "forfeit") {
    if (typeof body?.matchId !== "string") return NextResponse.json({ error: "Match required." }, { status: 400 });
    const result = await forfeitBattle(body.matchId, user.id);
    if (!result.ok) return NextResponse.json({ error: "This battle can no longer be forfeited." }, { status: 400 });
    return NextResponse.json({ ok: true, delta: result.delta ?? 0 });
  }

  if (action === "disconnect" || action === "reconnect" || action === "heartbeat") {
    if (typeof body?.matchId !== "string") return NextResponse.json({ error: "Match required." }, { status: 400 });
    await resolveExpiredMatch(body.matchId);
    const match = (await prisma.$queryRawUnsafe<any[]>(`SELECT status FROM "BattleMatch" WHERE id=$1`, body.matchId))[0];
    if (!match) return NextResponse.json({ error: "Match not found." }, { status: 404 });
    const member = (await prisma.$queryRawUnsafe<any[]>(`SELECT "reconnectUntilAt" FROM "BattleMatchPlayer" WHERE "matchId"=$1 AND "userId"=$2`, body.matchId, user.id))[0];
    if (!member) return NextResponse.json({ error: "Battle player not found." }, { status: 404 });
    if (action === "disconnect") {
      const deadline = new Date(Date.now() + RECONNECT_WINDOW_MS).toISOString();
      await prisma.$executeRawUnsafe(`UPDATE "BattleMatchPlayer" SET "disconnectedAt"=CURRENT_TIMESTAMP,"reconnectUntilAt"=$3,"lastSeenAt"=CURRENT_TIMESTAMP WHERE "matchId"=$1 AND "userId"=$2`, body.matchId, user.id, deadline);
      return NextResponse.json({ ok: true, reconnectUntil: deadline });
    }
    if (action === "reconnect") {
      if (member.reconnectUntilAt && new Date(member.reconnectUntilAt).getTime() < Date.now() && match.status === "active") return NextResponse.json({ error: "The reconnect window has expired." }, { status: 409 });
      await prisma.$executeRawUnsafe(`UPDATE "BattleMatchPlayer" SET "disconnectedAt"=NULL,"reconnectUntilAt"=NULL,"lastSeenAt"=CURRENT_TIMESTAMP WHERE "matchId"=$1 AND "userId"=$2`, body.matchId, user.id);
      return NextResponse.json({ ok: true });
    }
    await prisma.$executeRawUnsafe(`UPDATE "BattleMatchPlayer" SET "lastSeenAt"=CURRENT_TIMESTAMP WHERE "matchId"=$1 AND "userId"=$2`, body.matchId, user.id);
    return NextResponse.json({ ok: true });
  }

  if (action === "cancel") {
    if (typeof body?.matchId !== "string") return NextResponse.json({ error: "Match required." }, { status: 400 });
    const deleted = await prisma.$executeRawUnsafe(`DELETE FROM "BattleMatch" WHERE id=$1 AND status='queue' AND EXISTS (SELECT 1 FROM "BattleMatchPlayer" WHERE "matchId"=$1 AND "userId"=$2) AND (SELECT COUNT(*) FROM "BattleMatchPlayer" WHERE "matchId"=$1)=1`, body.matchId, user.id);
    return NextResponse.json({ ok: deleted > 0 });
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
  if (!matchId) {
    const activeMatch = (await prisma.$queryRawUnsafe<any[]>(`SELECT bm.id,bm.status,bm."matchType",bm.mode,bm."responseDeadlineAt",bm."createdAt" FROM "BattleMatch" bm JOIN "BattleMatchPlayer" bp ON bp."matchId"=bm.id WHERE bp."userId"=$1 AND bm.status IN ('queue','map_vote','active') ORDER BY bm."createdAt" DESC LIMIT 1`, user.id))[0] ?? null;
    return NextResponse.json({ activeMatch });
  }
  const data = await loadMatch(matchId, user.id);
  if (!data) return NextResponse.json({ error: "Match not found." }, { status: 404 });
  return NextResponse.json(data);
}
