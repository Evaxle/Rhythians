import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { fetchRhythiaScores, findScoreForMap } from "@/lib/daily";
import { getRankInfo } from "@/lib/ranks";
import { teamScore } from "@/lib/battles";
import {
  TOURNAMENT_CAPS,
  TOURNAMENT_SPLITS,
  buildTournamentBrackets,
  forceTournamentWinner,
  getTournamentAdminState,
  getTournamentPublicState,
  splitForRhp,
  tournamentTeamSize,
  type TournamentMode,
  type TournamentSplit,
  type TournamentStreamIdentity,
  type TournamentStreamPlatform,
} from "@/lib/tournaments";

const uid = () => randomUUID();
const REVEAL_COUNTDOWN_MS = 60_000;
const READY_COUNTDOWN_MS = 60_000;
const IDLE_WARNING_MS = 5 * 60_000;
const IDLE_FINAL_WARNING_MS = 8 * 60_000;
const IDLE_KICK_MS = 10 * 60_000;

function mode(value: unknown): TournamentMode | null {
  return value === "1v1" || value === "2v2" || value === "3v3" ? value : null;
}

function streamPlatform(value: unknown): TournamentStreamPlatform | null {
  return value === "steam" || value === "nightly" ? value : null;
}

function streamIdentity(value: unknown): TournamentStreamIdentity | null {
  return value === "discord" || value === "rhythia" ? value : null;
}

function targetFor(tournament: any) {
  const tournamentMode = mode(tournament?.mode);
  if (!tournamentMode) return 0;
  const configured = Number(tournament.targetPlayersPerSplit);
  return TOURNAMENT_CAPS[tournamentMode].includes(configured as never) ? configured : TOURNAMENT_CAPS[tournamentMode][2];
}

function matchesPerSplit(tournament: any) {
  const tournamentMode = mode(tournament?.mode);
  if (!tournamentMode) return 0;
  const teams = targetFor(tournament) / tournamentTeamSize(tournamentMode);
  return Number.isInteger(teams) && teams > 1 ? teams - 1 : 0;
}

async function tournamentRow(tournamentId: string) {
  return (await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "Tournament" WHERE id=$1`, tournamentId))[0] ?? null;
}

async function notifyOnce(tournamentId: string, userId: string, eventKey: string, title: string, message: string) {
  const inserted = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `INSERT INTO "TournamentNotificationLog" (id,"tournamentId","userId","eventKey") VALUES ($1,$2,$3,$4) ON CONFLICT ("tournamentId","userId","eventKey") DO NOTHING RETURNING id`,
    uid(), tournamentId, userId, eventKey,
  );
  if (!inserted.length) return;
  await prisma.notification.create({ data: { userId, type: "announcement", title, message, url: `/tournaments/${tournamentId}` } }).catch(() => null);
}

async function notifyTeam(tournamentId: string, teamId: string | null, eventKey: string, title: string, message: string) {
  if (!teamId) return;
  const members = await prisma.$queryRawUnsafe<Array<{ userId: string }>>(`SELECT "userId" FROM "TournamentTeamMember" WHERE "teamId"=$1`, teamId);
  await Promise.all(members.map((member) => notifyOnce(tournamentId, member.userId, eventKey, title, message)));
}

async function splitCounts(tournamentId: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ split: TournamentSplit; count: number }>>(
    `SELECT split,COUNT(*)::int AS count FROM "TournamentSignup" WHERE "tournamentId"=$1 AND status NOT IN ('withdrawn','kicked') GROUP BY split`,
    tournamentId,
  );
  return {
    lower: Number(rows.find((row) => row.split === "lower")?.count ?? 0),
    higher: Number(rows.find((row) => row.split === "higher")?.count ?? 0),
  };
}

export async function registerForTournamentRuntime(tournamentId: string, input: { id: string; streamOptIn?: boolean; streamPlatform?: unknown; streamIdentity?: unknown }) {
  await prisma.$transaction(async (tx) => {
    const tournament = (await tx.$queryRawUnsafe<any[]>(`SELECT * FROM "Tournament" WHERE id=$1 FOR UPDATE`, tournamentId))[0];
    if (!tournament || tournament.status !== "scheduled") throw new Error("Tournament registration is closed.");
    const tournamentMode = mode(tournament.mode);
    if (!tournamentMode) throw new Error("Tournament mode is invalid.");
    const account = (await tx.$queryRawUnsafe<any[]>(
      `SELECT u.id,u.rhp,u."discordId",u."inGuild",u."rhythiaVerified",rp.username AS "rhythiaUsername",rp."profileId" AS "rhythiaProfileId" FROM "User" u LEFT JOIN "RhythiaProfile" rp ON rp."userId"=u.id WHERE u.id=$1`,
      input.id,
    ))[0];
    if (!account || !account.rhythiaVerified || !account.rhythiaProfileId) throw new Error("A verified linked Rhythia account is required before you can sign up for a tournament.");

    const optIn = Boolean(input.streamOptIn);
    const platform = optIn ? streamPlatform(input.streamPlatform) : null;
    const identity = optIn ? streamIdentity(input.streamIdentity) : null;
    if (optIn && (!platform || !identity)) throw new Error("Choose a Rhythia version and livestream identity, or turn livestream opt-in off.");
    if (platform === "nightly" && (identity !== "discord" || !account.discordId || !account.inGuild)) throw new Error("Nightly livestream players must use a connected Discord account that is currently in the Rhythians server.");
    if (platform === "steam" && identity === "discord" && !account.discordId) throw new Error("Connect Discord or select your verified Rhythia identity for Steam livestream coverage.");

    const rhp = Number(account.rhp);
    const rank = getRankInfo(rhp);
    const split = splitForRhp(rhp);
    const existing = (await tx.$queryRawUnsafe<any[]>(`SELECT id,status,split FROM "TournamentSignup" WHERE "tournamentId"=$1 AND "userId"=$2`, tournamentId, input.id))[0];
    const currentCount = Number((await tx.$queryRawUnsafe<Array<{ count: number }>>(
      `SELECT COUNT(*)::int AS count FROM "TournamentSignup" WHERE "tournamentId"=$1 AND split=$2 AND "userId"<>$3 AND status NOT IN ('withdrawn','kicked')`, tournamentId, split, input.id,
    ))[0]?.count ?? 0);
    const target = targetFor(tournament);
    if (currentCount >= target && (!existing || existing.status === "withdrawn" || existing.split !== split)) throw new Error(`${split === "lower" ? "Lower" : "Higher"} split has reached its ${target}-player tournament bracket and is unavailable to join.`);

    await tx.$executeRawUnsafe(
      `INSERT INTO "TournamentSignup" (id,"tournamentId","userId",split,"rankName","rankIndex","rankTier","rhpSnapshot",status,"streamOptIn","streamPlatform","streamIdentity","signedUpAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'registered',$9,$10,$11,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT ("tournamentId","userId") DO UPDATE SET split=EXCLUDED.split,"rankName"=EXCLUDED."rankName","rankIndex"=EXCLUDED."rankIndex","rankTier"=EXCLUDED."rankTier","rhpSnapshot"=EXCLUDED."rhpSnapshot",status='registered',"streamOptIn"=EXCLUDED."streamOptIn","streamPlatform"=EXCLUDED."streamPlatform","streamIdentity"=EXCLUDED."streamIdentity","requestedSplit"=NULL,"splitRequestStatus"='none',"signedUpAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP`,
      existing?.id ?? uid(), tournamentId, input.id, split, rank.name, rank.index, rank.tier, rhp, optIn, platform, identity,
    );
  });
  return getTournamentRuntimeState(tournamentId, input.id);
}

export async function getTournamentRuntimePreflight(tournamentId: string) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const tournament = await tournamentRow(tournamentId);
  if (!tournament) return { ready: false, errors: ["Tournament not found."], warnings };
  if (tournament.status !== "scheduled") errors.push("Only a scheduled tournament can be started.");
  const tournamentMode = mode(tournament.mode);
  if (!tournamentMode) return { ready: false, errors: [...errors, "Tournament mode is invalid."], warnings };
  const target = targetFor(tournament);
  const teamSize = tournamentTeamSize(tournamentMode);
  if (!TOURNAMENT_CAPS[tournamentMode].includes(target as never)) errors.push("The configured player target is invalid for this tournament mode.");
  const counts = await splitCounts(tournamentId);
  const mapRequired = matchesPerSplit(tournament);
  for (const split of TOURNAMENT_SPLITS) {
    const label = split === "lower" ? "Lower" : "Higher";
    if (counts[split] !== target) errors.push(`${label} split must have exactly ${target} active signups; it currently has ${counts[split]}.`);
    const maps = Number((await prisma.$queryRawUnsafe<Array<{ count: number }>>(
      `SELECT COUNT(DISTINCT p."mapId")::int AS count FROM "TournamentMapPool" p JOIN "ChallengeMap" m ON m.id=p."mapId" WHERE p."tournamentId"=$1 AND p.split=$2 AND m.status::text='approved' AND m.rating IS NOT NULL AND m."reviewerNote" IS DISTINCT FROM 'rhythia-unranked'`, tournamentId, split,
    ))[0]?.count ?? 0);
    if (maps < mapRequired) errors.push(`${label} map pool needs ${mapRequired} unique ranked maps for a ${target}-player bracket; it currently has ${maps}.`);
    const invalidMaps = Number((await prisma.$queryRawUnsafe<Array<{ count: number }>>(
      `SELECT COUNT(*)::int AS count FROM "TournamentMapPool" p JOIN "ChallengeMap" m ON m.id=p."mapId" WHERE p."tournamentId"=$1 AND p.split=$2 AND NOT (m.status::text='approved' AND m.rating IS NOT NULL AND m."reviewerNote" IS DISTINCT FROM 'rhythia-unranked')`, tournamentId, split,
    ))[0]?.count ?? 0);
    if (invalidMaps) errors.push(`${label} pool contains ${invalidMaps} map${invalidMaps === 1 ? "" : "s"} that are no longer ranked and approved.`);
  }
  const pendingRequests = Number((await prisma.$queryRawUnsafe<Array<{ count: number }>>(`SELECT COUNT(*)::int AS count FROM "TournamentSignup" WHERE "tournamentId"=$1 AND "splitRequestStatus"='pending' AND status NOT IN ('withdrawn','kicked')`, tournamentId))[0]?.count ?? 0);
  if (pendingRequests) errors.push(`${pendingRequests} split change request${pendingRequests === 1 ? " is" : "s are"} still pending.`);
  const unverified = await prisma.$queryRawUnsafe<any[]>(`SELECT u.username FROM "TournamentSignup" s JOIN "User" u ON u.id=s."userId" LEFT JOIN "RhythiaProfile" rp ON rp."userId"=u.id WHERE s."tournamentId"=$1 AND s.status NOT IN ('withdrawn','kicked') AND (u."rhythiaVerified"=FALSE OR rp."profileId" IS NULL) LIMIT 10`, tournamentId);
  if (unverified.length) errors.push(`Every entrant must remain Rhythia-verified. Fix: ${unverified.map((row) => row.username).join(", ")}.`);
  const activeOther = Number((await prisma.$queryRawUnsafe<Array<{ count: number }>>(`SELECT COUNT(*)::int AS count FROM "Tournament" WHERE status='active' AND id<>$1`, tournamentId))[0]?.count ?? 0);
  if (activeOther) errors.push("Another tournament is already active.");
  if (target / teamSize < 4) warnings.push("This is a small bracket; the tournament still uses the same runtime protections and timing phases.");
  return { ready: errors.length === 0, errors, warnings, targetPlayersPerSplit: target, mapsRequiredPerSplit: mapRequired };
}

async function assignUniqueMaps(tournamentId: string, split: TournamentSplit) {
  const matches = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM "TournamentMatch" WHERE "tournamentId"=$1 AND split=$2 ORDER BY round,position`, tournamentId, split);
  const maps = await prisma.$queryRawUnsafe<Array<{ mapId: string }>>(
    `SELECT p."mapId" FROM "TournamentMapPool" p JOIN "ChallengeMap" m ON m.id=p."mapId" WHERE p."tournamentId"=$1 AND p.split=$2 AND m.status::text='approved' AND m.rating IS NOT NULL AND m."reviewerNote" IS DISTINCT FROM 'rhythia-unranked' ORDER BY RANDOM()`, tournamentId, split,
  );
  if (maps.length < matches.length) throw new Error(`${split} split does not have enough unique ranked maps.`);
  for (let index = 0; index < matches.length; index += 1) {
    await prisma.$executeRawUnsafe(`UPDATE "TournamentMatch" SET "mapId"=$2,"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1`, matches[index].id, maps[index].mapId);
  }
}

export async function startTournamentRuntime(tournamentId: string) {
  const preflight = await getTournamentRuntimePreflight(tournamentId);
  if (!preflight.ready) throw new Error(preflight.errors[0] ?? "Tournament preflight failed.");
  await buildTournamentBrackets(tournamentId);
  const postBuild = await getTournamentRuntimePreflight(tournamentId);
  if (!postBuild.ready) throw new Error(postBuild.errors[0] ?? "Tournament bracket preflight failed.");
  await assignUniqueMaps(tournamentId, "lower");
  await assignUniqueMaps(tournamentId, "higher");

  const tournament = await tournamentRow(tournamentId);
  const accepted = await prisma.$queryRawUnsafe<Array<{ userId: string; split: TournamentSplit }>>(`SELECT "userId",split FROM "TournamentSignup" WHERE "tournamentId"=$1 AND status='accepted'`, tournamentId);
  const conflictRows = await prisma.$queryRawUnsafe<any[]>(`SELECT DISTINCT u.username FROM "BattleMatch" bm JOIN "BattleMatchPlayer" bp ON bp."matchId"=bm.id JOIN "User" u ON u.id=bp."userId" WHERE bp."userId"=ANY($1::text[]) AND bm.status IN ('queue','map_vote','active','invite')`, accepted.map((row) => row.userId));
  if (conflictRows.length) throw new Error(`Players must leave current battles first: ${conflictRows.slice(0, 5).map((row) => row.username).join(", ")}${conflictRows.length > 5 ? "…" : ""}`);
  const intermissionSeconds = Number(tournament.intermissionSeconds ?? 300);
  const firstPhaseEnd = new Date(Date.now() + intermissionSeconds * 1000);

  await prisma.$transaction(async (tx) => {
    const changed = await tx.$executeRawUnsafe(`UPDATE "Tournament" SET status='active',"startedAt"=CURRENT_TIMESTAMP,"completedAt"=NULL,"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1 AND status='scheduled'`, tournamentId);
    if (!changed) throw new Error("Tournament could not be started.");
    await tx.$executeRawUnsafe(`UPDATE "TournamentMatch" SET status='intermission',"countdownEndsAt"=$2,"mapRevealAt"=NULL,"playStartsAt"=NULL,"updatedAt"=CURRENT_TIMESTAMP WHERE "tournamentId"=$1 AND round=1 AND "team1Id" IS NOT NULL AND "team2Id" IS NOT NULL`, tournamentId, firstPhaseEnd);
    for (const entrant of accepted) {
      await tx.$executeRawUnsafe(`INSERT INTO "TournamentPresence" (id,"tournamentId","userId",split,"lastSeenAt") VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP) ON CONFLICT ("tournamentId","userId") DO UPDATE SET split=EXCLUDED.split,"lastSeenAt"=CURRENT_TIMESTAMP,"warningStage"=0,"kickedAt"=NULL,"updatedAt"=CURRENT_TIMESTAMP`, uid(), tournamentId, entrant.userId, entrant.split);
    }
  });
  await Promise.all(accepted.map((entrant) => notifyOnce(tournamentId, entrant.userId, "tournament-start", `${tournament.name} is live`, `The bracket is locked. Your first matchup enters a ${Math.round(intermissionSeconds / 60)}-minute preparation period now.`)));
  return getTournamentRuntimeState(tournamentId, null);
}

async function normalizeAdvancedMatches(tournamentId: string) {
  const tournament = await tournamentRow(tournamentId);
  if (!tournament || tournament.status !== "active") return;
  const deadline = new Date(Date.now() + Number(tournament.intermissionSeconds ?? 300) * 1000);
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; team1Id: string; team2Id: string; round: number }>>(`UPDATE "TournamentMatch" SET status='intermission',"countdownEndsAt"=$2,"mapRevealAt"=NULL,"playStartsAt"=NULL,"updatedAt"=CURRENT_TIMESTAMP WHERE "tournamentId"=$1 AND status='countdown' AND round>1 AND "team1Id" IS NOT NULL AND "team2Id" IS NOT NULL RETURNING id,"team1Id","team2Id",round`, tournamentId, deadline);
  for (const row of rows) {
    const eventKey = `round-${row.round}-match-${row.id}-ready`;
    await notifyTeam(tournamentId, row.team1Id, eventKey, "Next tournament match determined", `Your next opponent is ready. You have ${Math.round(Number(tournament.intermissionSeconds ?? 300) / 60)} minutes before the map reveal countdown.`);
    await notifyTeam(tournamentId, row.team2Id, eventKey, "Next tournament match determined", `Your next opponent is ready. You have ${Math.round(Number(tournament.intermissionSeconds ?? 300) / 60)} minutes before the map reveal countdown.`);
  }
}

async function activatePreparedMatch(match: any, tournament: any) {
  const claimed = (await prisma.$queryRawUnsafe<any[]>(`UPDATE "TournamentMatch" SET status='activating',"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1 AND status='map_ready' AND "playStartsAt"<=CURRENT_TIMESTAMP RETURNING *`, match.id))[0];
  if (!claimed) return;
  const map = claimed.mapId ? await prisma.challengeMap.findUnique({ where: { id: claimed.mapId }, select: { id: true } }) : null;
  if (!map) {
    await prisma.$executeRawUnsafe(`UPDATE "TournamentMatch" SET status='needs_admin',"forfeitReason"='Assigned map missing',"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1`, match.id);
    return;
  }
  const tournamentMode = mode(tournament.mode);
  if (!tournamentMode) return;
  const members = await prisma.$queryRawUnsafe<any[]>(`SELECT tm."teamId",tm."userId" FROM "TournamentTeamMember" tm WHERE tm."teamId" IN ($1,$2) ORDER BY tm."teamId",tm.slot`, claimed.team1Id, claimed.team2Id);
  const teamOne = members.filter((member) => member.teamId === claimed.team1Id);
  const teamTwo = members.filter((member) => member.teamId === claimed.team2Id);
  const teamSize = tournamentTeamSize(tournamentMode);
  if (teamOne.length !== teamSize || teamTwo.length !== teamSize) {
    await prisma.$executeRawUnsafe(`UPDATE "TournamentMatch" SET status='needs_admin',"forfeitReason"='Incomplete team',"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1`, match.id);
    return;
  }
  const battleMatchId = uid();
  const deadline = new Date(Date.now() + Number(tournament.matchDurationSeconds ?? 600) * 1000);
  const battleMode = `${tournamentMode}:${tournamentMode === "1v1" ? "regular" : "captains"}`;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`INSERT INTO "BattleMatch" (id,"matchType",mode,status,"mapId","startedAt","responseDeadlineAt","casualMapMode") VALUES ($1,'tournament',$2,'active',$3,CURRENT_TIMESTAMP,$4,'tournament')`, battleMatchId, battleMode, map.id, deadline);
    for (const member of teamOne) await tx.$executeRawUnsafe(`INSERT INTO "BattleMatchPlayer" (id,"matchId","userId",team,"lastSeenAt") VALUES ($1,$2,$3,1,CURRENT_TIMESTAMP)`, uid(), battleMatchId, member.userId);
    for (const member of teamTwo) await tx.$executeRawUnsafe(`INSERT INTO "BattleMatchPlayer" (id,"matchId","userId",team,"lastSeenAt") VALUES ($1,$2,$3,2,CURRENT_TIMESTAMP)`, uid(), battleMatchId, member.userId);
    await tx.$executeRawUnsafe(`UPDATE "TournamentMatch" SET status='active',"battleMatchId"=$2,"matchDeadlineAt"=$3,"startedAt"=CURRENT_TIMESTAMP,"team1Score"=NULL,"team2Score"=NULL,"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1 AND status='activating'`, match.id, battleMatchId, deadline);
  });
  const minutes = Math.ceil(Number(tournament.matchDurationSeconds ?? 600) / 60);
  await notifyTeam(tournament.id, claimed.team1Id, `match-live-${match.id}`, "Tournament match is live", `Play the revealed map now and submit your recent score within ${minutes} minutes.`);
  await notifyTeam(tournament.id, claimed.team2Id, `match-live-${match.id}`, "Tournament match is live", `Play the revealed map now and submit your recent score within ${minutes} minutes.`);
}

async function warnMissingScores(tournamentId: string, battleMatchId: string, matchId: string) {
  const missing = await prisma.$queryRawUnsafe<Array<{ userId: string }>>(`SELECT "userId" FROM "BattleMatchPlayer" WHERE "matchId"=$1 AND accuracy IS NULL`, battleMatchId);
  await Promise.all(missing.map((player) => notifyOnce(tournamentId, player.userId, `score-missed-${matchId}`, "Tournament score not submitted", "The match deadline expired without a score from you. Your team can lose the matchup automatically. Submit on time in your next tournament match.")));
}

async function resolveExpiredMatch(match: any, tournament: any) {
  if (!match.battleMatchId) return;
  const players = await prisma.$queryRawUnsafe<any[]>(`SELECT bp."userId",bp.team,bp.accuracy,t.seed FROM "BattleMatchPlayer" bp JOIN "TournamentTeamMember" tm ON tm."userId"=bp."userId" AND tm."tournamentId"=$2 JOIN "TournamentTeam" t ON t.id=tm."teamId" WHERE bp."matchId"=$1`, match.battleMatchId, tournament.id);
  const onePlayers = players.filter((player) => Number(player.team) === 1);
  const twoPlayers = players.filter((player) => Number(player.team) === 2);
  const oneSubmitted = onePlayers.filter((player) => player.accuracy != null).length;
  const twoSubmitted = twoPlayers.filter((player) => player.accuracy != null).length;
  const captains = String(tournament.mode) !== "1v1";
  const oneScore = teamScore(onePlayers.map((player) => player.accuracy == null ? null : Number(player.accuracy)), captains ? "captains" : "regular");
  const twoScore = teamScore(twoPlayers.map((player) => player.accuracy == null ? null : Number(player.accuracy)), captains ? "captains" : "regular");
  let winnerTeamId: string;
  if (oneSubmitted !== twoSubmitted) winnerTeamId = oneSubmitted > twoSubmitted ? match.team1Id : match.team2Id;
  else if (oneScore != null && twoScore != null && oneScore !== twoScore) winnerTeamId = oneScore > twoScore ? match.team1Id : match.team2Id;
  else if (oneScore != null && twoScore == null) winnerTeamId = match.team1Id;
  else if (twoScore != null && oneScore == null) winnerTeamId = match.team2Id;
  else {
    const teamOneSeed = Number(onePlayers[0]?.seed ?? Number.MAX_SAFE_INTEGER);
    const teamTwoSeed = Number(twoPlayers[0]?.seed ?? Number.MAX_SAFE_INTEGER);
    winnerTeamId = teamOneSeed <= teamTwoSeed ? match.team1Id : match.team2Id;
  }
  await warnMissingScores(tournament.id, match.battleMatchId, match.id);
  await prisma.$executeRawUnsafe(`UPDATE "BattleMatch" SET status='finished',"finishedAt"=CURRENT_TIMESTAMP WHERE id=$1 AND status='active'`, match.battleMatchId);
  await prisma.$executeRawUnsafe(`UPDATE "TournamentMatch" SET status='needs_admin',"forfeitReason"='Automatic deadline resolution',"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1 AND status='active'`, match.id);
  await forceTournamentWinner(match.id, winnerTeamId);
  await normalizeAdvancedMatches(tournament.id);
}

async function resolveKickedTeams(tournamentId: string) {
  const matches = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "TournamentMatch" WHERE "tournamentId"=$1 AND status IN ('waiting','intermission','map_countdown','map_ready','active') AND "team1Id" IS NOT NULL AND "team2Id" IS NOT NULL`, tournamentId);
  for (const match of matches) {
    const rows = await prisma.$queryRawUnsafe<Array<{ teamId: string; kicked: number; seed: number }>>(
      `SELECT t.id AS "teamId",t.seed,COUNT(*) FILTER (WHERE s.status='kicked')::int AS kicked FROM "TournamentTeam" t JOIN "TournamentTeamMember" tm ON tm."teamId"=t.id JOIN "TournamentSignup" s ON s."tournamentId"=tm."tournamentId" AND s."userId"=tm."userId" WHERE t.id IN ($1,$2) GROUP BY t.id,t.seed`, match.team1Id, match.team2Id,
    );
    const one = rows.find((row) => row.teamId === match.team1Id);
    const two = rows.find((row) => row.teamId === match.team2Id);
    if (!one?.kicked && !two?.kicked) continue;
    const winnerTeamId = one?.kicked && !two?.kicked ? match.team2Id : two?.kicked && !one?.kicked ? match.team1Id : Number(one?.seed ?? 9999) <= Number(two?.seed ?? 9999) ? match.team1Id : match.team2Id;
    if (match.battleMatchId) await prisma.$executeRawUnsafe(`UPDATE "BattleMatch" SET status='finished',"finishedAt"=CURRENT_TIMESTAMP WHERE id=$1 AND status='active'`, match.battleMatchId);
    if (match.status !== "active" && match.status !== "needs_admin") await prisma.$executeRawUnsafe(`UPDATE "TournamentMatch" SET status='needs_admin',"forfeitReason"='Idle participant removed',"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1`, match.id);
    await forceTournamentWinner(match.id, winnerTeamId);
    await normalizeAdvancedMatches(tournamentId);
  }
}

async function enforcePresence(tournamentId: string) {
  const now = Date.now();
  const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT p.*,u.username FROM "TournamentPresence" p JOIN "User" u ON u.id=p."userId" WHERE p."tournamentId"=$1 AND p."kickedAt" IS NULL`, tournamentId);
  for (const row of rows) {
    const idle = now - new Date(row.lastSeenAt).getTime();
    if (idle >= IDLE_KICK_MS) {
      const changed = await prisma.$executeRawUnsafe(`UPDATE "TournamentPresence" SET "warningStage"=3,"kickedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1 AND "kickedAt" IS NULL`, row.id);
      if (changed) {
        await prisma.$executeRawUnsafe(`UPDATE "TournamentSignup" SET status='kicked',"updatedAt"=CURRENT_TIMESTAMP WHERE "tournamentId"=$1 AND "userId"=$2 AND status='accepted'`, tournamentId, row.userId);
        await notifyOnce(tournamentId, row.userId, "idle-kicked", "Removed from tournament for inactivity", "You were inactive on the tournament page for 10 minutes. Your current or next matchup is forfeited so the bracket can continue.");
      }
    } else if (idle >= IDLE_FINAL_WARNING_MS && Number(row.warningStage) < 2) {
      await prisma.$executeRawUnsafe(`UPDATE "TournamentPresence" SET "warningStage"=2,"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1 AND "warningStage"<2`, row.id);
      await notifyOnce(tournamentId, row.userId, "idle-8m", "Final inactivity warning", "You have been inactive for 8 minutes. Return to the tournament page within 2 minutes or you will be removed from the bracket.");
    } else if (idle >= IDLE_WARNING_MS && Number(row.warningStage) < 1) {
      await prisma.$executeRawUnsafe(`UPDATE "TournamentPresence" SET "warningStage"=1,"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1 AND "warningStage"<1`, row.id);
      await notifyOnce(tournamentId, row.userId, "idle-5m", "Tournament inactivity warning", "You have been inactive for 5 minutes. Keep the tournament page active so you do not miss your matchup.");
    }
  }
  await resolveKickedTeams(tournamentId);
}

export async function heartbeatTournament(tournamentId: string, userId: string) {
  const changed = await prisma.$executeRawUnsafe(`UPDATE "TournamentPresence" SET "lastSeenAt"=CURRENT_TIMESTAMP,"warningStage"=0,"updatedAt"=CURRENT_TIMESTAMP WHERE "tournamentId"=$1 AND "userId"=$2 AND "kickedAt" IS NULL`, tournamentId, userId);
  if (!changed) throw new Error("You are not an active participant in this tournament.");
  const activeMatch = await prisma.$queryRawUnsafe<Array<{ battleMatchId: string }>>(`SELECT tm."battleMatchId" FROM "TournamentMatch" tm JOIN "TournamentTeamMember" tmem ON tmem."teamId" IN (tm."team1Id",tm."team2Id") AND tmem."userId"=$2 WHERE tm."tournamentId"=$1 AND tm.status='active' AND tm."battleMatchId" IS NOT NULL LIMIT 1`, tournamentId, userId);
  if (activeMatch[0]?.battleMatchId) await prisma.$executeRawUnsafe(`UPDATE "BattleMatchPlayer" SET "lastSeenAt"=CURRENT_TIMESTAMP WHERE "matchId"=$1 AND "userId"=$2`, activeMatch[0].battleMatchId, userId);
  return { ok: true };
}

export async function syncTournamentRuntime(tournamentId: string) {
  const tournament = await tournamentRow(tournamentId);
  if (!tournament || tournament.status !== "active") return;
  await enforcePresence(tournamentId);
  await normalizeAdvancedMatches(tournamentId);

  const intermissions = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "TournamentMatch" WHERE "tournamentId"=$1 AND status='intermission' AND "countdownEndsAt"<=CURRENT_TIMESTAMP`, tournamentId);
  for (const match of intermissions) {
    const revealAt = new Date(Date.now() + REVEAL_COUNTDOWN_MS);
    const changed = await prisma.$executeRawUnsafe(`UPDATE "TournamentMatch" SET status='map_countdown',"countdownEndsAt"=$2,"mapRevealAt"=$2,"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1 AND status='intermission'`, match.id, revealAt);
    if (changed) {
      await notifyTeam(tournamentId, match.team1Id, `map-countdown-${match.id}`, "Map reveal in 1 minute", "Open the tournament page now. Your assigned ranked map will be revealed in one minute.");
      await notifyTeam(tournamentId, match.team2Id, `map-countdown-${match.id}`, "Map reveal in 1 minute", "Open the tournament page now. Your assigned ranked map will be revealed in one minute.");
    }
  }

  const reveals = await prisma.$queryRawUnsafe<any[]>(`SELECT tm.*,m.title AS "mapTitle" FROM "TournamentMatch" tm LEFT JOIN "ChallengeMap" m ON m.id=tm."mapId" WHERE tm."tournamentId"=$1 AND tm.status='map_countdown' AND tm."mapRevealAt"<=CURRENT_TIMESTAMP`, tournamentId);
  for (const match of reveals) {
    const startsAt = new Date(Date.now() + READY_COUNTDOWN_MS);
    const changed = await prisma.$executeRawUnsafe(`UPDATE "TournamentMatch" SET status='map_ready',"countdownEndsAt"=$2,"playStartsAt"=$2,"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1 AND status='map_countdown'`, match.id, startsAt);
    if (changed) {
      await notifyTeam(tournamentId, match.team1Id, `map-reveal-${match.id}`, `Map selected: ${match.mapTitle ?? "Tournament map"}`, "You have one minute to load the map. When the countdown ends, play it and then submit your newest Rhythia score.");
      await notifyTeam(tournamentId, match.team2Id, `map-reveal-${match.id}`, `Map selected: ${match.mapTitle ?? "Tournament map"}`, "You have one minute to load the map. When the countdown ends, play it and then submit your newest Rhythia score.");
    }
  }

  const ready = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "TournamentMatch" WHERE "tournamentId"=$1 AND status='map_ready' AND "playStartsAt"<=CURRENT_TIMESTAMP`, tournamentId);
  for (const match of ready) await activatePreparedMatch(match, tournament);

  const expired = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "TournamentMatch" WHERE "tournamentId"=$1 AND status='active' AND "matchDeadlineAt"<=CURRENT_TIMESTAMP`, tournamentId);
  for (const match of expired) await resolveExpiredMatch(match, tournament);
}

export async function submitTournamentScoreRuntime(tournamentId: string, userId: string) {
  await syncTournamentRuntime(tournamentId);
  const row = (await prisma.$queryRawUnsafe<any[]>(`SELECT tm.id AS "tournamentMatchId",tm."battleMatchId",tm."matchDeadlineAt",tm."mapId",bp.accuracy FROM "TournamentMatch" tm JOIN "BattleMatchPlayer" bp ON bp."matchId"=tm."battleMatchId" AND bp."userId"=$2 WHERE tm."tournamentId"=$1 AND tm.status='active' ORDER BY tm.round DESC LIMIT 1`, tournamentId, userId))[0];
  if (!row) throw new Error("You do not have an active tournament match.");
  if (row.accuracy != null) return { alreadySubmitted: true, accuracy: Number(row.accuracy) };
  if (row.matchDeadlineAt && new Date(row.matchDeadlineAt).getTime() <= Date.now()) throw new Error("The match timer has ended.");
  const map = await prisma.challengeMap.findUnique({ where: { id: row.mapId }, select: { title: true } });
  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId }, select: { profileId: true } });
  if (!map || !profile) throw new Error("A linked Rhythia account is required for tournament scoring.");
  let recent;
  try { recent = (await fetchRhythiaScores(profile.profileId)).recent; } catch { throw new Error("Could not retrieve recent Rhythia scores."); }
  const score = findScoreForMap(recent, map.title);
  if (!score) throw new Error("No matching recent Rhythia score was found. Play the revealed map after the match starts, then try again.");
  const accuracy = Number(score.accuracy);
  if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100) throw new Error("The recent score did not contain a valid accuracy.");
  await prisma.$executeRawUnsafe(`UPDATE "BattleMatchPlayer" SET accuracy=$3,score=$3,"scoreId"=$4,"checkedAt"=CURRENT_TIMESTAMP,"scoreSubmittedAt"=CURRENT_TIMESTAMP,"lastSeenAt"=CURRENT_TIMESTAMP WHERE "matchId"=$1 AND "userId"=$2 AND accuracy IS NULL`, row.battleMatchId, userId, accuracy, String(score.id));
  await notifyOnce(tournamentId, userId, `score-received-${row.tournamentMatchId}`, "Tournament score received", `${accuracy.toFixed(2)}% was locked for this match.`);
  const remaining = Number((await prisma.$queryRawUnsafe<Array<{ count: number }>>(`SELECT COUNT(*)::int AS count FROM "BattleMatchPlayer" WHERE "matchId"=$1 AND accuracy IS NULL`, row.battleMatchId))[0]?.count ?? 0);
  if (!remaining) {
    const match = (await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "TournamentMatch" WHERE id=$1`, row.tournamentMatchId))[0];
    const tournament = await tournamentRow(tournamentId);
    await resolveExpiredMatch({ ...match, matchDeadlineAt: new Date(0) }, tournament);
  }
  return { alreadySubmitted: false, accuracy, finished: remaining === 0 };
}

export async function forfeitTournamentMatchRuntime(tournamentId: string, userId: string) {
  await syncTournamentRuntime(tournamentId);
  const row = (await prisma.$queryRawUnsafe<any[]>(`SELECT tm.id,tm."battleMatchId",tm."team1Id",tm."team2Id",bp.team FROM "TournamentMatch" tm JOIN "BattleMatchPlayer" bp ON bp."matchId"=tm."battleMatchId" AND bp."userId"=$2 WHERE tm."tournamentId"=$1 AND tm.status='active' ORDER BY tm.round DESC LIMIT 1`, tournamentId, userId))[0];
  if (!row) throw new Error("You do not have an active tournament match to forfeit.");
  const winnerTeamId = Number(row.team) === 1 ? row.team2Id : row.team1Id;
  await prisma.$executeRawUnsafe(`UPDATE "BattleMatch" SET status='finished',"finishedAt"=CURRENT_TIMESTAMP WHERE id=$1 AND status='active'`, row.battleMatchId);
  await prisma.$executeRawUnsafe(`UPDATE "TournamentMatch" SET status='needs_admin',"forfeitReason"='Participant forfeit',"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1`, row.id);
  await forceTournamentWinner(row.id, winnerTeamId);
  await notifyOnce(tournamentId, userId, `forfeit-${row.id}`, "Tournament match forfeited", "Your opponent has advanced. You can continue watching the tournament brackets and finals.");
  await normalizeAdvancedMatches(tournamentId);
  return { ok: true };
}

export async function getTournamentRuntimeState(tournamentId: string, viewerId: string | null) {
  await syncTournamentRuntime(tournamentId);
  const base = await getTournamentPublicState(tournamentId, viewerId);
  if (!base) return null;
  const tournament = base.tournament;
  const target = targetFor(tournament);
  const requiredMaps = matchesPerSplit(tournament);
  let currentMatch = base.currentMatch;
  if (viewerId && base.viewerTeam && !base.viewerEliminated) {
    currentMatch = base.matches.find((match: any) => (match.team1Id === base.viewerTeam.id || match.team2Id === base.viewerTeam.id) && ["intermission","map_countdown","map_ready","active","needs_admin"].includes(match.status))
      ?? base.matches.find((match: any) => (match.team1Id === base.viewerTeam.id || match.team2Id === base.viewerTeam.id) && match.status === "waiting" && !match.winnerTeamId)
      ?? null;
  }
  const presence = viewerId ? (await prisma.$queryRawUnsafe<any[]>(`SELECT "lastSeenAt","warningStage","kickedAt" FROM "TournamentPresence" WHERE "tournamentId"=$1 AND "userId"=$2`, tournamentId, viewerId))[0] ?? null : null;
  const finalMatches = base.matches.filter((match: any) => match.side === "final");
  return {
    ...base,
    currentMatch,
    runtime: {
      targetPlayersPerSplit: target,
      mapsRequiredPerSplit: requiredMaps,
      matchDurationSeconds: Number(tournament.matchDurationSeconds ?? 600),
      intermissionSeconds: Number(tournament.intermissionSeconds ?? 300),
      presence,
      finalMatches,
      canonicalPath: `/tournaments/${tournamentId}`,
    },
  };
}

export async function getTournamentsRuntimeHome(viewerId: string | null) {
  const active = (await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM "Tournament" WHERE status='active' ORDER BY "startedAt" DESC NULLS LAST LIMIT 1`))[0];
  const scheduled = (await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM "Tournament" WHERE status='scheduled' AND "publishedAt" IS NOT NULL ORDER BY "scheduledAt" ASC LIMIT 1`))[0];
  const recent = !active ? (await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM "Tournament" WHERE status='completed' ORDER BY "completedAt" DESC NULLS LAST LIMIT 1`))[0] : null;
  return {
    active: active ? await getTournamentRuntimeState(active.id, viewerId) : null,
    scheduled: scheduled ? await getTournamentRuntimeState(scheduled.id, viewerId) : null,
    recent: recent ? await getTournamentRuntimeState(recent.id, viewerId) : null,
  };
}

export async function getTournamentRuntimeAdminState(tournamentId?: string | null) {
  const state = await getTournamentAdminState(tournamentId);
  if (!state.selected) return state;
  const selected = await getTournamentRuntimeState(state.selected.tournament.id, null);
  if (!selected) return state;
  const preflight = selected.tournament.status === "scheduled" ? await getTournamentRuntimePreflight(selected.tournament.id) : null;
  return { ...state, selected: { ...state.selected, ...selected, signups: state.selected.signups, streamSignups: state.selected.streamSignups, preflight } };
}

export async function updateTournamentRuntimeSettings(tournamentId: string, input: { targetPlayersPerSplit?: number; matchDurationSeconds?: number; intermissionSeconds?: number }) {
  const tournament = await tournamentRow(tournamentId);
  if (!tournament || tournament.status !== "scheduled") throw new Error("Runtime settings can only be changed before the tournament starts.");
  const tournamentMode = mode(tournament.mode);
  if (!tournamentMode) throw new Error("Tournament mode is invalid.");
  const target = input.targetPlayersPerSplit ?? targetFor(tournament);
  if (!TOURNAMENT_CAPS[tournamentMode].includes(target as never)) throw new Error(`Target must be one of ${TOURNAMENT_CAPS[tournamentMode].join(", ")} players per split for ${tournamentMode}.`);
  const matchSeconds = input.matchDurationSeconds ?? Number(tournament.matchDurationSeconds ?? 600);
  const intermissionSeconds = input.intermissionSeconds ?? Number(tournament.intermissionSeconds ?? 300);
  if (!Number.isInteger(matchSeconds) || matchSeconds < 300 || matchSeconds > 1800) throw new Error("Match duration must be between 5 and 30 minutes.");
  if (!Number.isInteger(intermissionSeconds) || intermissionSeconds < 300 || intermissionSeconds > 600) throw new Error("Intermission must be between 5 and 10 minutes.");
  const counts = await splitCounts(tournamentId);
  if (counts.lower > target || counts.higher > target) throw new Error("The new target is smaller than the current signup count. Move or withdraw extra entrants first.");
  await prisma.$executeRawUnsafe(`UPDATE "Tournament" SET "targetPlayersPerSplit"=$2,"matchDurationSeconds"=$3,"intermissionSeconds"=$4,"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1`, tournamentId, target, matchSeconds, intermissionSeconds);
}

export async function listTournamentChat(tournamentId: string, userId: string) {
  const signup = (await prisma.$queryRawUnsafe<any[]>(`SELECT split,status FROM "TournamentSignup" WHERE "tournamentId"=$1 AND "userId"=$2`, tournamentId, userId))[0];
  if (!signup || !["accepted","kicked"].includes(signup.status)) throw new Error("Tournament chat is available to bracket participants.");
  const messages = await prisma.$queryRawUnsafe<any[]>(`SELECT c.id,c.content,c."createdAt",u.id AS "userId",u.username,u."displayName",u."profileHandle",u.avatar,u."discordId" FROM "TournamentChatMessage" c JOIN "User" u ON u.id=c."userId" WHERE c."tournamentId"=$1 AND c.split=$2 ORDER BY c."createdAt" DESC LIMIT 100`, tournamentId, signup.split);
  return { split: signup.split as TournamentSplit, messages: messages.reverse() };
}

export async function sendTournamentChat(tournamentId: string, userId: string, content: string) {
  const text = content.trim();
  if (!text || text.length > 500) throw new Error("Chat messages must be between 1 and 500 characters.");
  const signup = (await prisma.$queryRawUnsafe<any[]>(`SELECT split,status FROM "TournamentSignup" WHERE "tournamentId"=$1 AND "userId"=$2`, tournamentId, userId))[0];
  if (!signup || signup.status !== "accepted") throw new Error("Only active bracket participants can send tournament chat messages.");
  const recent = (await prisma.$queryRawUnsafe<Array<{ createdAt: Date }>>(`SELECT "createdAt" FROM "TournamentChatMessage" WHERE "tournamentId"=$1 AND "userId"=$2 ORDER BY "createdAt" DESC LIMIT 1`, tournamentId, userId))[0];
  if (recent && Date.now() - new Date(recent.createdAt).getTime() < 1500) throw new Error("You are sending messages too quickly.");
  await prisma.$executeRawUnsafe(`INSERT INTO "TournamentChatMessage" (id,"tournamentId",split,"userId",content) VALUES ($1,$2,$3,$4,$5)`, uid(), tournamentId, signup.split, userId, text);
  return listTournamentChat(tournamentId, userId);
}
