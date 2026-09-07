import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { fetchRhythiaScores, findScoreForMap } from "@/lib/daily";
import { getRankInfo, rankLabel } from "@/lib/ranks";
import { rankTierValue, teamScore } from "@/lib/battles";
import { isRankedMap } from "@/lib/rhythkit-api";

export type TournamentMode = "1v1" | "2v2" | "3v3";
export type TournamentSplit = "lower" | "higher";
export type TournamentStreamPlatform = "steam" | "nightly";
export type TournamentStreamIdentity = "discord" | "rhythia";

export const TOURNAMENT_MODES: TournamentMode[] = ["1v1", "2v2", "3v3"];
export const TOURNAMENT_SPLITS: TournamentSplit[] = ["lower", "higher"];
export const TOURNAMENT_SPLIT_RANKS: Record<TournamentSplit, string[]> = {
  lower: ["Copper", "Bronze", "Silver", "Gold", "Platinum", "Diamond"],
  higher: ["Emerald", "Master", "Expert"],
};
export const TOURNAMENT_CAPS: Record<TournamentMode, [number, number, number]> = {
  "1v1": [4, 8, 16],
  "2v2": [8, 16, 32],
  "3v3": [12, 24, 48],
};

const uid = () => randomUUID();
const COUNTDOWN_MS = 60_000;

function asMode(value: unknown): TournamentMode | null {
  return typeof value === "string" && TOURNAMENT_MODES.includes(value as TournamentMode) ? value as TournamentMode : null;
}

function asSplit(value: unknown): TournamentSplit | null {
  return typeof value === "string" && TOURNAMENT_SPLITS.includes(value as TournamentSplit) ? value as TournamentSplit : null;
}

function asStreamPlatform(value: unknown): TournamentStreamPlatform | null {
  return value === "steam" || value === "nightly" ? value : null;
}

function asStreamIdentity(value: unknown): TournamentStreamIdentity | null {
  return value === "discord" || value === "rhythia" ? value : null;
}

export function tournamentTeamSize(mode: TournamentMode) {
  return Number(mode.split("v")[0]);
}

export function splitForRhp(rhp: number): TournamentSplit {
  const name = getRankInfo(rhp).name;
  return TOURNAMENT_SPLIT_RANKS.higher.includes(name) ? "higher" : "lower";
}

export function tournamentCapState(mode: TournamentMode, count: number) {
  const caps = TOURNAMENT_CAPS[mode];
  const secured = count >= caps[2] ? caps[2] : count >= caps[1] ? caps[1] : count >= caps[0] ? caps[0] : 0;
  const next = secured === 0 ? caps[0] : secured === caps[0] ? caps[1] : secured === caps[1] ? caps[2] : null;
  return {
    count,
    caps,
    minimum: caps[0],
    secured,
    next,
    maximum: caps[2],
    canStart: count >= caps[0],
    full: count >= caps[2],
    atRisk: next != null && count > secured,
  };
}

function tournamentMatchLengthSeconds(length: number | null | undefined) {
  const safe = Number.isFinite(Number(length)) && Number(length) > 0 ? Number(length) : 180;
  return Math.max(600, 3 * Math.min(300, safe));
}

async function tournamentRow(id: string) {
  return (await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "Tournament" WHERE id=$1`, id))[0] ?? null;
}

async function splitCounts(tournamentId: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ split: TournamentSplit; count: number }>>(
    `SELECT split,COUNT(*)::int AS count FROM "TournamentSignup" WHERE "tournamentId"=$1 AND status<>'withdrawn' GROUP BY split`,
    tournamentId,
  );
  return {
    lower: Number(rows.find((row) => row.split === "lower")?.count ?? 0),
    higher: Number(rows.find((row) => row.split === "higher")?.count ?? 0),
  };
}

async function loadTeams(tournamentId: string) {
  const teams = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "TournamentTeam" WHERE "tournamentId"=$1 ORDER BY split,seed`, tournamentId);
  const members = await prisma.$queryRawUnsafe<any[]>(
    `SELECT tm.*,u.username,u."displayName",u."profileHandle",u.rhp FROM "TournamentTeamMember" tm JOIN "User" u ON u.id=tm."userId" WHERE tm."tournamentId"=$1 ORDER BY tm."teamId",tm.slot`,
    tournamentId,
  );
  return teams.map((team) => ({ ...team, members: members.filter((member) => member.teamId === team.id) }));
}

async function loadMatches(tournamentId: string, teams?: any[]) {
  const resolvedTeams = teams ?? await loadTeams(tournamentId);
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT tm.*,m.title AS "mapTitle",m.artist AS "mapArtist",m.length AS "mapLength",m.rating AS "mapRating",m."mapFileUrl",m."imageUrl" FROM "TournamentMatch" tm LEFT JOIN "ChallengeMap" m ON m.id=tm."mapId" WHERE tm."tournamentId"=$1 ORDER BY tm.split,tm.round,tm.position`,
    tournamentId,
  );
  const battleIds = rows.map((row) => row.battleMatchId).filter(Boolean);
  const scoreRows = battleIds.length ? await prisma.$queryRawUnsafe<any[]>(
    `SELECT bp."matchId",bp."userId",bp.team,bp.accuracy,bp."scoreSubmittedAt" FROM "BattleMatchPlayer" bp WHERE bp."matchId"=ANY($1::text[])`,
    battleIds,
  ) : [];
  const decorateTeam = (team: any, battleMatchId: string | null) => team ? {
    ...team,
    members: (team.members ?? []).map((member: any) => {
      const score = battleMatchId ? scoreRows.find((row) => row.matchId === battleMatchId && row.userId === member.userId) : null;
      return { ...member, accuracy: score?.accuracy == null ? null : Number(score.accuracy), scoreSubmittedAt: score?.scoreSubmittedAt ?? null };
    }),
  } : null;
  return rows.map((row) => ({
    ...row,
    team1: decorateTeam(resolvedTeams.find((team) => team.id === row.team1Id) ?? null, row.battleMatchId),
    team2: decorateTeam(resolvedTeams.find((team) => team.id === row.team2Id) ?? null, row.battleMatchId),
    winner: decorateTeam(resolvedTeams.find((team) => team.id === row.winnerTeamId) ?? null, row.battleMatchId),
    map: row.mapId ? { id: row.mapId, title: row.mapTitle, artist: row.mapArtist, length: row.mapLength, rating: row.mapRating, mapFileUrl: row.mapFileUrl, imageUrl: row.imageUrl } : null,
  }));
}

async function loadMapPool(tournamentId: string) {
  return prisma.$queryRawUnsafe<any[]>(
    `SELECT p.id,p.split,p."mapId",p."createdAt",m.title,m.artist,m.rating,m.length,m.status,m."mapFileUrl",m."imageUrl" FROM "TournamentMapPool" p JOIN "ChallengeMap" m ON m.id=p."mapId" WHERE p."tournamentId"=$1 AND m.status::text='approved' AND m.rating IS NOT NULL AND m."reviewerNote" IS DISTINCT FROM 'rhythia-unranked' ORDER BY p.split,m.title`,
    tournamentId,
  );
}

async function viewerEligibility(userId: string | null) {
  if (!userId) return null;
  const row = (await prisma.$queryRawUnsafe<any[]>(
    `SELECT u.id,u."discordId",u."inGuild",u."rhythiaVerified",rp.username AS "rhythiaUsername",rp."profileId" AS "rhythiaProfileId" FROM "User" u LEFT JOIN "RhythiaProfile" rp ON rp."userId"=u.id WHERE u.id=$1`,
    userId,
  ))[0];
  if (!row) return null;
  const verifiedRhythia = Boolean(row.rhythiaVerified && row.rhythiaProfileId);
  return {
    canSignUp: verifiedRhythia,
    rhythiaVerified: verifiedRhythia,
    rhythiaUsername: row.rhythiaUsername ?? null,
    discordLinked: Boolean(row.discordId),
    discordId: row.discordId ?? null,
    discordInGuild: Boolean(row.discordId && row.inGuild),
  };
}

function sideFor(round: number, rounds: number, position: number) {
  if (round === rounds) return "final";
  const matchesInRound = 2 ** (rounds - round);
  return position < matchesInRound / 2 ? "left" : "right";
}

function balancedPair(entries: any[], teamSize: number) {
  const a: any[] = [];
  const b: any[] = [];
  entries.forEach((entry, index) => {
    const toA = (Math.floor(index / 2) + (index % 2)) % 2 === 0;
    (toA ? a : b).push(entry);
  });
  if (a.length !== teamSize || b.length !== teamSize) throw new Error("Could not balance tournament teams.");
  return [a, b] as const;
}

async function refreshTeamAverage(teamId: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ value: number }>>(
    `SELECT COALESCE(AVG((s."rankIndex"*5)+(s."rankTier"-1)),0)::float AS value FROM "TournamentTeamMember" tm JOIN "TournamentSignup" s ON s."tournamentId"=tm."tournamentId" AND s."userId"=tm."userId" WHERE tm."teamId"=$1`,
    teamId,
  );
  await prisma.$executeRawUnsafe(`UPDATE "TournamentTeam" SET "averageTier"=$2 WHERE id=$1`, teamId, Number(rows[0]?.value ?? 0));
}

async function reseedRoundOne(tournamentId: string, split: TournamentSplit) {
  const tournament = await tournamentRow(tournamentId);
  if (!tournament || tournament.status !== "scheduled") throw new Error("Brackets can only be edited before a tournament starts.");
  const teams = await prisma.$queryRawUnsafe<any[]>(`SELECT id FROM "TournamentTeam" WHERE "tournamentId"=$1 AND split=$2 ORDER BY seed`, tournamentId, split);
  for (let position = 0; position < teams.length / 2; position += 1) {
    await prisma.$executeRawUnsafe(
      `UPDATE "TournamentMatch" SET "team1Id"=$4,"team2Id"=$5,"winnerTeamId"=NULL,"team1Score"=NULL,"team2Score"=NULL,status='waiting',"countdownEndsAt"=NULL,"battleMatchId"=NULL,"mapId"=NULL,"matchDeadlineAt"=NULL,"startedAt"=NULL,"finishedAt"=NULL,"updatedAt"=CURRENT_TIMESTAMP WHERE "tournamentId"=$1 AND split=$2 AND round=1 AND position=$3`,
      tournamentId,
      split,
      position,
      teams[position * 2]?.id ?? null,
      teams[position * 2 + 1]?.id ?? null,
    );
  }
  await prisma.$executeRawUnsafe(
    `UPDATE "TournamentMatch" SET "team1Id"=NULL,"team2Id"=NULL,"winnerTeamId"=NULL,"team1Score"=NULL,"team2Score"=NULL,status='waiting',"countdownEndsAt"=NULL,"battleMatchId"=NULL,"mapId"=NULL,"matchDeadlineAt"=NULL,"startedAt"=NULL,"finishedAt"=NULL,"updatedAt"=CURRENT_TIMESTAMP WHERE "tournamentId"=$1 AND split=$2 AND round>1`,
    tournamentId,
    split,
  );
}

export async function buildTournamentBrackets(tournamentId: string) {
  const tournament = await tournamentRow(tournamentId);
  if (!tournament) throw new Error("Tournament not found.");
  if (tournament.status !== "scheduled") throw new Error("Only scheduled tournaments can rebuild brackets.");
  const mode = asMode(tournament.mode);
  if (!mode) throw new Error("Tournament mode is invalid.");
  const teamSize = tournamentTeamSize(mode);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`DELETE FROM "TournamentMatch" WHERE "tournamentId"=$1`, tournamentId);
    await tx.$executeRawUnsafe(`DELETE FROM "TournamentTeamMember" WHERE "tournamentId"=$1`, tournamentId);
    await tx.$executeRawUnsafe(`DELETE FROM "TournamentTeam" WHERE "tournamentId"=$1`, tournamentId);
    await tx.$executeRawUnsafe(`UPDATE "TournamentSignup" SET status='registered',"updatedAt"=CURRENT_TIMESTAMP WHERE "tournamentId"=$1 AND status<>'withdrawn'`, tournamentId);

    for (const split of TOURNAMENT_SPLITS) {
      const signups = await tx.$queryRawUnsafe<any[]>(
        `SELECT * FROM "TournamentSignup" WHERE "tournamentId"=$1 AND split=$2 AND status<>'withdrawn' ORDER BY priority DESC,"signedUpAt" ASC,id ASC`,
        tournamentId,
        split,
      );
      const cap = tournamentCapState(mode, signups.length);
      if (!cap.secured) continue;
      const selected = signups.slice(0, cap.secured);
      const selectedIds = selected.map((entry) => entry.id);
      await tx.$executeRawUnsafe(`UPDATE "TournamentSignup" SET status='waitlisted',"updatedAt"=CURRENT_TIMESTAMP WHERE "tournamentId"=$1 AND split=$2 AND status<>'withdrawn'`, tournamentId, split);
      await tx.$executeRawUnsafe(`UPDATE "TournamentSignup" SET status='accepted',"updatedAt"=CURRENT_TIMESTAMP WHERE id=ANY($1::text[])`, selectedIds);

      const skilled = [...selected].sort((a, b) => rankTierValue(Number(a.rhpSnapshot)) - rankTierValue(Number(b.rhpSnapshot)) || new Date(a.signedUpAt).getTime() - new Date(b.signedUpAt).getTime());
      const teams: Array<{ id: string; members: any[] }> = [];
      for (let start = 0; start < skilled.length; start += teamSize * 2) {
        const block = skilled.slice(start, start + teamSize * 2);
        const [one, two] = balancedPair(block, teamSize);
        for (const members of [one, two]) {
          const teamId = uid();
          const seed = teams.length + 1;
          const averageTier = members.reduce((sum, member) => sum + rankTierValue(Number(member.rhpSnapshot)), 0) / members.length;
          await tx.$executeRawUnsafe(`INSERT INTO "TournamentTeam" (id,"tournamentId",split,seed,"averageTier") VALUES ($1,$2,$3,$4,$5)`, teamId, tournamentId, split, seed, averageTier);
          for (let slot = 0; slot < members.length; slot += 1) {
            await tx.$executeRawUnsafe(`INSERT INTO "TournamentTeamMember" (id,"tournamentId","teamId","userId",slot) VALUES ($1,$2,$3,$4,$5)`, uid(), tournamentId, teamId, members[slot].userId, slot + 1);
          }
          teams.push({ id: teamId, members });
        }
      }

      const rounds = Math.log2(teams.length);
      if (!Number.isInteger(rounds)) throw new Error("Tournament bracket requires a power-of-two team count.");
      for (let round = 1; round <= rounds; round += 1) {
        const matchCount = 2 ** (rounds - round);
        for (let position = 0; position < matchCount; position += 1) {
          const firstRound = round === 1;
          await tx.$executeRawUnsafe(
            `INSERT INTO "TournamentMatch" (id,"tournamentId",split,round,position,side,"team1Id","team2Id",status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'waiting')`,
            uid(),
            tournamentId,
            split,
            round,
            position,
            sideFor(round, rounds, position),
            firstRound ? teams[position * 2]?.id ?? null : null,
            firstRound ? teams[position * 2 + 1]?.id ?? null : null,
          );
        }
      }
    }
  });

  return getTournamentPublicState(tournamentId, null);
}

export async function getTournamentPreflight(tournamentId: string) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const tournament = await tournamentRow(tournamentId);
  if (!tournament) return { ready: false, errors: ["Tournament not found."], warnings };
  if (tournament.status !== "scheduled") errors.push("Only a scheduled tournament can be started.");
  const mode = asMode(tournament.mode);
  if (!mode) return { ready: false, errors: [...errors, "Tournament mode is invalid."], warnings };
  const teamSize = tournamentTeamSize(mode);
  const activeOther = Number((await prisma.$queryRawUnsafe<Array<{ count: number }>>(`SELECT COUNT(*)::int AS count FROM "Tournament" WHERE status='active' AND id<>$1`, tournamentId))[0]?.count ?? 0);
  if (activeOther) errors.push("Another tournament is already active. Finish it before starting this one.");
  const pendingRequests = Number((await prisma.$queryRawUnsafe<Array<{ count: number }>>(`SELECT COUNT(*)::int AS count FROM "TournamentSignup" WHERE "tournamentId"=$1 AND "splitRequestStatus"='pending' AND status<>'withdrawn'`, tournamentId))[0]?.count ?? 0);
  if (pendingRequests) errors.push(`${pendingRequests} split change request${pendingRequests === 1 ? " is" : "s are"} still pending.`);
  const unverified = await prisma.$queryRawUnsafe<any[]>(
    `SELECT u.username FROM "TournamentSignup" s JOIN "User" u ON u.id=s."userId" LEFT JOIN "RhythiaProfile" rp ON rp."userId"=u.id WHERE s."tournamentId"=$1 AND s.status<>'withdrawn' AND (u."rhythiaVerified"=FALSE OR rp."profileId" IS NULL) LIMIT 10`,
    tournamentId,
  );
  if (unverified.length) errors.push(`Every entrant must have a verified linked Rhythia account. Fix: ${unverified.map((row) => row.username).join(", ")}.`);
  const counts = await splitCounts(tournamentId);
  for (const split of TOURNAMENT_SPLITS) {
    const label = split === "lower" ? "Lower" : "Higher";
    const cap = tournamentCapState(mode, counts[split]);
    if (!cap.canStart) errors.push(`${label} split has not reached its ${cap.minimum}-player minimum.`);
    if (cap.atRisk) warnings.push(`${label} has ${cap.count} signups but only ${cap.secured} are secured; remaining entrants will be waitlisted unless the split reaches ${cap.next}.`);
    const invalidMaps = Number((await prisma.$queryRawUnsafe<Array<{ count: number }>>(
      `SELECT COUNT(*)::int AS count FROM "TournamentMapPool" p JOIN "ChallengeMap" m ON m.id=p."mapId" WHERE p."tournamentId"=$1 AND p.split=$2 AND NOT (m.status::text='approved' AND m.rating IS NOT NULL AND m."reviewerNote" IS DISTINCT FROM 'rhythia-unranked')`,
      tournamentId,
      split,
    ))[0]?.count ?? 0);
    const rankedMaps = Number((await prisma.$queryRawUnsafe<Array<{ count: number }>>(
      `SELECT COUNT(*)::int AS count FROM "TournamentMapPool" p JOIN "ChallengeMap" m ON m.id=p."mapId" WHERE p."tournamentId"=$1 AND p.split=$2 AND m.status::text='approved' AND m.rating IS NOT NULL AND m."reviewerNote" IS DISTINCT FROM 'rhythia-unranked'`,
      tournamentId,
      split,
    ))[0]?.count ?? 0);
    if (!rankedMaps) errors.push(`${label} split needs at least one ranked map.`);
    if (invalidMaps) errors.push(`${label} map pool contains ${invalidMaps} unranked map${invalidMaps === 1 ? "" : "s"}. Remove them before starting.`);
    const accepted = Number((await prisma.$queryRawUnsafe<Array<{ count: number }>>(`SELECT COUNT(*)::int AS count FROM "TournamentSignup" WHERE "tournamentId"=$1 AND split=$2 AND status='accepted'`, tournamentId, split))[0]?.count ?? 0);
    const teamCount = Number((await prisma.$queryRawUnsafe<Array<{ count: number }>>(`SELECT COUNT(*)::int AS count FROM "TournamentTeam" WHERE "tournamentId"=$1 AND split=$2`, tournamentId, split))[0]?.count ?? 0);
    const memberCount = Number((await prisma.$queryRawUnsafe<Array<{ count: number }>>(`SELECT COUNT(*)::int AS count FROM "TournamentTeamMember" tm JOIN "TournamentTeam" t ON t.id=tm."teamId" WHERE tm."tournamentId"=$1 AND t.split=$2`, tournamentId, split))[0]?.count ?? 0);
    const matchCount = Number((await prisma.$queryRawUnsafe<Array<{ count: number }>>(`SELECT COUNT(*)::int AS count FROM "TournamentMatch" WHERE "tournamentId"=$1 AND split=$2`, tournamentId, split))[0]?.count ?? 0);
    if (teamCount === 0 || matchCount === 0) errors.push(`${label} bracket has not been generated.`);
    if (teamCount > 0 && (teamCount & (teamCount - 1)) !== 0) errors.push(`${label} bracket team count must be a power of two.`);
    if (accepted !== cap.secured) errors.push(`${label} accepted-player count does not match the secured cap. Rebuild the bracket.`);
    if (teamCount && memberCount !== teamCount * teamSize) errors.push(`${label} has an incomplete team. Rebuild or fix player placement.`);
    if (memberCount !== accepted) errors.push(`${label} bracket does not contain every accepted player exactly once.`);
  }
  return { ready: errors.length === 0, errors, warnings };
}

export async function startTournament(tournamentId: string) {
  const tournament = await tournamentRow(tournamentId);
  if (!tournament) throw new Error("Tournament not found.");
  const preflight = await getTournamentPreflight(tournamentId);
  if (!preflight.ready) throw new Error(preflight.errors[0] ?? "Tournament preflight failed.");
  const accepted = await prisma.$queryRawUnsafe<Array<{ userId: string }>>(`SELECT "userId" FROM "TournamentSignup" WHERE "tournamentId"=$1 AND status='accepted'`, tournamentId);
  if (!accepted.length) throw new Error("No players were accepted into this tournament.");
  const activeConflicts = await prisma.$queryRawUnsafe<any[]>(
    `SELECT DISTINCT u.username,bm.id FROM "BattleMatch" bm JOIN "BattleMatchPlayer" bp ON bp."matchId"=bm.id JOIN "User" u ON u.id=bp."userId" WHERE bp."userId"=ANY($1::text[]) AND bm.status IN ('queue','map_vote','active','invite')`,
    accepted.map((row) => row.userId),
  );
  if (activeConflicts.length) throw new Error(`Players must leave current battles before the tournament starts: ${activeConflicts.slice(0, 5).map((row) => row.username).join(", ")}${activeConflicts.length > 5 ? "…" : ""}`);

  const countdown = new Date(Date.now() + COUNTDOWN_MS);
  await prisma.$transaction(async (tx) => {
    const activeOther = Number((await tx.$queryRawUnsafe<Array<{ count: number }>>(`SELECT COUNT(*)::int AS count FROM "Tournament" WHERE status='active' AND id<>$1`, tournamentId))[0]?.count ?? 0);
    if (activeOther) throw new Error("Another tournament is already active.");
    const changed = await tx.$executeRawUnsafe(`UPDATE "Tournament" SET status='active',"startedAt"=CURRENT_TIMESTAMP,"completedAt"=NULL,"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1 AND status='scheduled'`, tournamentId);
    if (!changed) throw new Error("Tournament could not be started.");
    await tx.$executeRawUnsafe(`UPDATE "TournamentMatch" SET status='countdown',"countdownEndsAt"=$2,"updatedAt"=CURRENT_TIMESTAMP WHERE "tournamentId"=$1 AND round=1 AND "team1Id" IS NOT NULL AND "team2Id" IS NOT NULL`, tournamentId, countdown);
  });

  for (const row of accepted) {
    await prisma.notification.create({ data: { userId: row.userId, type: "announcement", title: `${tournament.name} has started`, message: "Your tournament bracket is live. Your first match begins after the one-minute countdown.", url: `/tournaments/${tournamentId}` } }).catch(() => null);
  }
  await syncTournament(tournamentId);
  return getTournamentPublicState(tournamentId, null);
}

async function activateTournamentMatch(matchId: string) {
  const claimed = (await prisma.$queryRawUnsafe<any[]>(
    `UPDATE "TournamentMatch" SET status='activating',"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1 AND status='countdown' AND "countdownEndsAt"<=CURRENT_TIMESTAMP RETURNING *`,
    matchId,
  ))[0];
  if (!claimed) return;
  const tournament = await tournamentRow(claimed.tournamentId);
  if (!tournament || tournament.status !== "active") {
    await prisma.$executeRawUnsafe(`UPDATE "TournamentMatch" SET status='waiting',"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1 AND status='activating'`, matchId);
    return;
  }
  const mode = asMode(tournament.mode);
  if (!mode) throw new Error("Tournament mode is invalid.");
  const maps = await prisma.$queryRawUnsafe<any[]>(
    `SELECT m.id,m.length FROM "TournamentMapPool" p JOIN "ChallengeMap" m ON m.id=p."mapId" WHERE p."tournamentId"=$1 AND p.split=$2 AND m.status::text='approved' AND m.rating IS NOT NULL AND m."reviewerNote" IS DISTINCT FROM 'rhythia-unranked' ORDER BY RANDOM() LIMIT 1`,
    tournament.id,
    claimed.split,
  );
  const map = maps[0];
  if (!map) {
    await prisma.$executeRawUnsafe(`UPDATE "TournamentMatch" SET status='needs_admin',"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1`, matchId);
    return;
  }
  const members = await prisma.$queryRawUnsafe<any[]>(
    `SELECT tm."teamId",tm."userId" FROM "TournamentTeamMember" tm WHERE tm."teamId" IN ($1,$2) ORDER BY tm."teamId",tm.slot`,
    claimed.team1Id,
    claimed.team2Id,
  );
  const teamOne = members.filter((member) => member.teamId === claimed.team1Id);
  const teamTwo = members.filter((member) => member.teamId === claimed.team2Id);
  const teamSize = tournamentTeamSize(mode);
  if (teamOne.length !== teamSize || teamTwo.length !== teamSize) {
    await prisma.$executeRawUnsafe(`UPDATE "TournamentMatch" SET status='needs_admin',"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1`, matchId);
    return;
  }
  const battleMatchId = uid();
  const deadline = new Date(Date.now() + tournamentMatchLengthSeconds(map.length) * 1000);
  const battleMode = `${mode}:${mode === "1v1" ? "regular" : "captains"}`;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `INSERT INTO "BattleMatch" (id,"matchType",mode,status,"mapId","startedAt","responseDeadlineAt","casualMapMode") VALUES ($1,'tournament',$2,'active',$3,CURRENT_TIMESTAMP,$4,'tournament')`,
      battleMatchId,
      battleMode,
      map.id,
      deadline,
    );
    for (const member of teamOne) await tx.$executeRawUnsafe(`INSERT INTO "BattleMatchPlayer" (id,"matchId","userId",team,"lastSeenAt") VALUES ($1,$2,$3,1,CURRENT_TIMESTAMP)`, uid(), battleMatchId, member.userId);
    for (const member of teamTwo) await tx.$executeRawUnsafe(`INSERT INTO "BattleMatchPlayer" (id,"matchId","userId",team,"lastSeenAt") VALUES ($1,$2,$3,2,CURRENT_TIMESTAMP)`, uid(), battleMatchId, member.userId);
    await tx.$executeRawUnsafe(
      `UPDATE "TournamentMatch" SET status='active',"battleMatchId"=$2,"mapId"=$3,"matchDeadlineAt"=$4,"startedAt"=CURRENT_TIMESTAMP,"team1Score"=NULL,"team2Score"=NULL,"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1 AND status='activating'`,
      matchId,
      battleMatchId,
      map.id,
      deadline,
    );
  });
}

async function advanceTournamentWinner(match: any, winnerTeamId: string, scores?: { one: number | null; two: number | null }) {
  const updated = (await prisma.$queryRawUnsafe<any[]>(
    `UPDATE "TournamentMatch" SET status='completed',"winnerTeamId"=$2,"team1Score"=COALESCE($3,"team1Score"),"team2Score"=COALESCE($4,"team2Score"),"finishedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1 AND status IN ('active','needs_admin','activating') RETURNING *`,
    match.id,
    winnerTeamId,
    scores?.one ?? null,
    scores?.two ?? null,
  ))[0];
  if (!updated) return;
  const finals = await prisma.$queryRawUnsafe<any[]>(`SELECT id,split,status,"winnerTeamId" FROM "TournamentMatch" WHERE "tournamentId"=$1 AND side='final'`, match.tournamentId);
  if (updated.side === "final") {
    if (finals.length === 2 && finals.every((row) => row.status === "completed" && row.winnerTeamId)) {
      await prisma.$executeRawUnsafe(`UPDATE "Tournament" SET status='completed',"completedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1 AND status='active'`, match.tournamentId);
    }
    return;
  }
  const nextRound = Number(updated.round) + 1;
  const nextPosition = Math.floor(Number(updated.position) / 2);
  const field = Number(updated.position) % 2 === 0 ? "team1Id" : "team2Id";
  await prisma.$executeRawUnsafe(`UPDATE "TournamentMatch" SET "${field}"=$4,"updatedAt"=CURRENT_TIMESTAMP WHERE "tournamentId"=$1 AND split=$2 AND round=$3 AND position=$5 AND "${field}" IS NULL`, updated.tournamentId, updated.split, nextRound, winnerTeamId, nextPosition);
  const next = (await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "TournamentMatch" WHERE "tournamentId"=$1 AND split=$2 AND round=$3 AND position=$4`, updated.tournamentId, updated.split, nextRound, nextPosition))[0];
  if (next?.team1Id && next?.team2Id && next.status === "waiting") {
    await prisma.$executeRawUnsafe(`UPDATE "TournamentMatch" SET status='countdown',"countdownEndsAt"=$2,"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1 AND status='waiting'`, next.id, new Date(Date.now() + COUNTDOWN_MS));
  }
}

async function battleScores(battleMatchId: string) {
  const battle = (await prisma.$queryRawUnsafe<any[]>(`SELECT mode FROM "BattleMatch" WHERE id=$1`, battleMatchId))[0];
  if (!battle) return { one: null, two: null, players: [] as any[] };
  const players = await prisma.$queryRawUnsafe<any[]>(`SELECT team,accuracy FROM "BattleMatchPlayer" WHERE "matchId"=$1`, battleMatchId);
  const captains = String(battle.mode).endsWith(":captains");
  const one = teamScore(players.filter((player) => Number(player.team) === 1).map((player) => player.accuracy == null ? null : Number(player.accuracy)), captains ? "captains" : "regular");
  const two = teamScore(players.filter((player) => Number(player.team) === 2).map((player) => player.accuracy == null ? null : Number(player.accuracy)), captains ? "captains" : "regular");
  return { one, two, players };
}

export async function resolveTournamentBattle(battleMatchId: string, forcedWinnerBattleTeam: 1 | 2 | null = null) {
  const match = (await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "TournamentMatch" WHERE "battleMatchId"=$1`, battleMatchId))[0];
  if (!match || match.status === "completed") return;
  const scores = await battleScores(battleMatchId);
  let winnerBattleTeam = forcedWinnerBattleTeam;
  if (!winnerBattleTeam) {
    const one = scores.one;
    const two = scores.two;
    if (one == null && two == null || one != null && two != null && one === two) {
      await prisma.$executeRawUnsafe(`UPDATE "TournamentMatch" SET status='needs_admin',"team1Score"=$2,"team2Score"=$3,"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1 AND status<>'completed'`, match.id, one, two);
      return;
    }
    winnerBattleTeam = one == null ? 2 : two == null ? 1 : one > two ? 1 : 2;
  }
  const winnerTeamId = winnerBattleTeam === 1 ? match.team1Id : match.team2Id;
  if (!winnerTeamId) {
    await prisma.$executeRawUnsafe(`UPDATE "TournamentMatch" SET status='needs_admin',"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1`, match.id);
    return;
  }
  await advanceTournamentWinner(match, winnerTeamId, scores);
}

async function resolveExpiredTournamentMatches(tournamentId: string) {
  const finished = await prisma.$queryRawUnsafe<any[]>(
    `SELECT tm."battleMatchId" FROM "TournamentMatch" tm JOIN "BattleMatch" bm ON bm.id=tm."battleMatchId" WHERE tm."tournamentId"=$1 AND tm.status='active' AND bm.status='finished'`,
    tournamentId,
  );
  for (const row of finished) await resolveTournamentBattle(row.battleMatchId);

  const expired = await prisma.$queryRawUnsafe<any[]>(
    `SELECT tm."battleMatchId" FROM "TournamentMatch" tm JOIN "BattleMatch" bm ON bm.id=tm."battleMatchId" WHERE tm."tournamentId"=$1 AND tm.status='active' AND tm."matchDeadlineAt"<=CURRENT_TIMESTAMP AND bm.status='active'`,
    tournamentId,
  );
  for (const row of expired) {
    await prisma.$executeRawUnsafe(`UPDATE "BattleMatch" SET status='finished',"finishedAt"=CURRENT_TIMESTAMP WHERE id=$1 AND status='active'`, row.battleMatchId);
    await resolveTournamentBattle(row.battleMatchId);
  }
}

export async function syncTournament(tournamentId: string) {
  const tournament = await tournamentRow(tournamentId);
  if (!tournament || tournament.status !== "active") return;
  await resolveExpiredTournamentMatches(tournamentId);
  const ready = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM "TournamentMatch" WHERE "tournamentId"=$1 AND status='countdown' AND "countdownEndsAt"<=CURRENT_TIMESTAMP ORDER BY round,position`,
    tournamentId,
  );
  for (const row of ready) await activateTournamentMatch(row.id);
}

export async function submitTournamentScore(tournamentId: string, userId: string) {
  await syncTournament(tournamentId);
  const row = (await prisma.$queryRawUnsafe<any[]>(
    `SELECT tm.id AS "tournamentMatchId",tm."battleMatchId",tm."matchDeadlineAt",bm."mapId",bm.status,bp.accuracy FROM "TournamentMatch" tm JOIN "BattleMatch" bm ON bm.id=tm."battleMatchId" JOIN "BattleMatchPlayer" bp ON bp."matchId"=bm.id AND bp."userId"=$2 WHERE tm."tournamentId"=$1 AND tm.status='active' AND bm.status='active' ORDER BY tm.round DESC LIMIT 1`,
    tournamentId,
    userId,
  ))[0];
  if (!row) throw new Error("You do not have an active tournament match.");
  if (row.accuracy != null) return { alreadySubmitted: true };
  if (row.matchDeadlineAt && new Date(row.matchDeadlineAt).getTime() <= Date.now()) throw new Error("The match timer has ended.");
  const map = await prisma.challengeMap.findUnique({ where: { id: row.mapId }, select: { title: true } });
  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId }, select: { profileId: true } });
  if (!map || !profile) throw new Error("Link your Rhythia account before playing a tournament match.");
  let recent;
  try {
    recent = (await fetchRhythiaScores(profile.profileId)).recent;
  } catch {
    throw new Error("Could not retrieve recent Rhythia scores.");
  }
  const score = findScoreForMap(recent, map.title);
  if (!score) throw new Error("No matching recent Rhythia score was found for this tournament map.");
  const accuracy = Number(score.accuracy);
  if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100) throw new Error("The recent Rhythia score did not contain a valid accuracy.");
  await prisma.$executeRawUnsafe(
    `UPDATE "BattleMatchPlayer" SET accuracy=$3,score=$3,"scoreId"=$4,"checkedAt"=CURRENT_TIMESTAMP,"scoreSubmittedAt"=CURRENT_TIMESTAMP,"lastSeenAt"=CURRENT_TIMESTAMP WHERE "matchId"=$1 AND "userId"=$2 AND accuracy IS NULL`,
    row.battleMatchId,
    userId,
    accuracy,
    String(score.id),
  );
  const remaining = Number((await prisma.$queryRawUnsafe<Array<{ count: number }>>(`SELECT COUNT(*)::int AS count FROM "BattleMatchPlayer" WHERE "matchId"=$1 AND accuracy IS NULL`, row.battleMatchId))[0]?.count ?? 0);
  if (!remaining) {
    await prisma.$executeRawUnsafe(`UPDATE "BattleMatch" SET status='finished',"finishedAt"=CURRENT_TIMESTAMP WHERE id=$1 AND status='active'`, row.battleMatchId);
    await resolveTournamentBattle(row.battleMatchId);
  }
  return { alreadySubmitted: false, accuracy, finished: remaining === 0 };
}

export async function forfeitTournamentMatch(tournamentId: string, userId: string) {
  await syncTournament(tournamentId);
  const row = (await prisma.$queryRawUnsafe<any[]>(
    `SELECT tm."battleMatchId",bp.team FROM "TournamentMatch" tm JOIN "BattleMatch" bm ON bm.id=tm."battleMatchId" JOIN "BattleMatchPlayer" bp ON bp."matchId"=bm.id AND bp."userId"=$2 WHERE tm."tournamentId"=$1 AND tm.status='active' AND bm.status='active' ORDER BY tm.round DESC LIMIT 1`,
    tournamentId,
    userId,
  ))[0];
  if (!row) throw new Error("You do not have an active tournament match to forfeit.");
  const winner = Number(row.team) === 1 ? 2 : 1;
  await prisma.$executeRawUnsafe(`UPDATE "BattleMatch" SET status='finished',"finishedAt"=CURRENT_TIMESTAMP WHERE id=$1 AND status='active'`, row.battleMatchId);
  await resolveTournamentBattle(row.battleMatchId, winner);
  return { ok: true };
}

export async function registerForTournament(tournamentId: string, input: { id: string; streamOptIn?: boolean; streamPlatform?: unknown; streamIdentity?: unknown }) {
  const tournament = await tournamentRow(tournamentId);
  if (!tournament || tournament.status !== "scheduled") throw new Error("Tournament registration is closed.");
  const mode = asMode(tournament.mode);
  if (!mode) throw new Error("Tournament mode is invalid.");
  const account = (await prisma.$queryRawUnsafe<any[]>(
    `SELECT u.id,u.rhp,u."discordId",u."inGuild",u."rhythiaVerified",rp.username AS "rhythiaUsername",rp."profileId" AS "rhythiaProfileId" FROM "User" u LEFT JOIN "RhythiaProfile" rp ON rp."userId"=u.id WHERE u.id=$1`,
    input.id,
  ))[0];
  if (!account || !account.rhythiaVerified || !account.rhythiaProfileId) throw new Error("A verified linked Rhythia account is required before you can sign up for a tournament.");
  const streamOptIn = Boolean(input.streamOptIn);
  const streamPlatform = streamOptIn ? asStreamPlatform(input.streamPlatform) : null;
  const streamIdentity = streamOptIn ? asStreamIdentity(input.streamIdentity) : null;
  if (streamOptIn && (!streamPlatform || !streamIdentity)) throw new Error("Choose a Rhythia version and livestream identity, or turn livestream opt-in off.");
  if (streamPlatform === "nightly") {
    if (streamIdentity !== "discord") throw new Error("Nightly livestream players must use Discord identity.");
    if (!account.discordId) throw new Error("Connect your Discord account before choosing Nightly livestream coverage.");
    if (!account.inGuild) throw new Error("Your connected Discord account must currently be in the Rhythians Discord server for Nightly livestream coverage.");
  }
  if (streamPlatform === "steam" && streamIdentity === "discord" && !account.discordId) throw new Error("Connect your Discord account or select your verified Rhythia account for Steam livestream coverage.");
  if (streamPlatform === "steam" && streamIdentity === "rhythia" && (!account.rhythiaVerified || !account.rhythiaProfileId)) throw new Error("A verified linked Rhythia account is required for this Steam livestream option.");
  const rhp = Number(account.rhp);
  const rank = getRankInfo(rhp);
  const split = splitForRhp(rhp);
  const count = Number((await prisma.$queryRawUnsafe<Array<{ count: number }>>(`SELECT COUNT(*)::int AS count FROM "TournamentSignup" WHERE "tournamentId"=$1 AND split=$2 AND "userId"<>$3 AND status<>'withdrawn'`, tournamentId, split, input.id))[0]?.count ?? 0);
  if (tournamentCapState(mode, count).full) throw new Error(`${split === "lower" ? "Lower" : "Higher"} split is full.`);
  await prisma.$executeRawUnsafe(
    `INSERT INTO "TournamentSignup" (id,"tournamentId","userId",split,"rankName","rankIndex","rankTier","rhpSnapshot",status,"streamOptIn","streamPlatform","streamIdentity","signedUpAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'registered',$9,$10,$11,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT ("tournamentId","userId") DO UPDATE SET split=EXCLUDED.split,"rankName"=EXCLUDED."rankName","rankIndex"=EXCLUDED."rankIndex","rankTier"=EXCLUDED."rankTier","rhpSnapshot"=EXCLUDED."rhpSnapshot",status='registered',"streamOptIn"=EXCLUDED."streamOptIn","streamPlatform"=EXCLUDED."streamPlatform","streamIdentity"=EXCLUDED."streamIdentity","requestedSplit"=NULL,"splitRequestStatus"='none',"signedUpAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP`,
    uid(),
    tournamentId,
    input.id,
    split,
    rank.name,
    rank.index,
    rank.tier,
    rhp,
    streamOptIn,
    streamPlatform,
    streamIdentity,
  );
  return getTournamentPublicState(tournamentId, input.id);
}

export async function withdrawTournamentSignup(tournamentId: string, userId: string) {
  const tournament = await tournamentRow(tournamentId);
  if (!tournament || tournament.status !== "scheduled") throw new Error("You can only withdraw before the tournament starts.");
  await prisma.$executeRawUnsafe(`UPDATE "TournamentSignup" SET status='withdrawn',"requestedSplit"=NULL,"splitRequestStatus"='none',"streamOptIn"=FALSE,"streamPlatform"=NULL,"streamIdentity"=NULL,"updatedAt"=CURRENT_TIMESTAMP WHERE "tournamentId"=$1 AND "userId"=$2`, tournamentId, userId);
}

export async function requestTournamentSplit(tournamentId: string, userId: string, requested: TournamentSplit) {
  const tournament = await tournamentRow(tournamentId);
  if (!tournament || tournament.status !== "scheduled") throw new Error("Split requests are closed.");
  const signup = (await prisma.$queryRawUnsafe<any[]>(`SELECT split,status FROM "TournamentSignup" WHERE "tournamentId"=$1 AND "userId"=$2`, tournamentId, userId))[0];
  if (!signup || signup.status === "withdrawn") throw new Error("Sign up before requesting another split.");
  if (signup.split === requested) throw new Error("You are already in that split.");
  await prisma.$executeRawUnsafe(`UPDATE "TournamentSignup" SET "requestedSplit"=$3,"splitRequestStatus"='pending',"updatedAt"=CURRENT_TIMESTAMP WHERE "tournamentId"=$1 AND "userId"=$2`, tournamentId, userId, requested);
}

export async function getTournamentPublicState(tournamentId: string, viewerId: string | null) {
  await syncTournament(tournamentId);
  const tournament = await tournamentRow(tournamentId);
  if (!tournament) return null;
  const mode = asMode(tournament.mode);
  if (!mode) return null;
  const counts = await splitCounts(tournamentId);
  const teams = await loadTeams(tournamentId);
  const matches = await loadMatches(tournamentId, teams);
  const mapPool = await loadMapPool(tournamentId);
  const eligibility = await viewerEligibility(viewerId);
  const viewerSignup = viewerId ? (await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "TournamentSignup" WHERE "tournamentId"=$1 AND "userId"=$2`, tournamentId, viewerId))[0] ?? null : null;
  const viewerTeam = viewerId ? teams.find((team) => team.members.some((member: any) => member.userId === viewerId)) ?? null : null;
  const viewerMatches = viewerTeam ? matches.filter((match) => match.team1Id === viewerTeam.id || match.team2Id === viewerTeam.id) : [];
  const loss = viewerTeam ? viewerMatches.find((match) => match.status === "completed" && match.winnerTeamId && match.winnerTeamId !== viewerTeam.id) : null;
  const currentMatch = viewerTeam && !loss ? viewerMatches.find((match) => ["countdown", "active", "needs_admin"].includes(match.status)) ?? viewerMatches.find((match) => match.status === "waiting" && !match.winnerTeamId) ?? null : null;
  const champions = {
    lower: matches.find((match) => match.split === "lower" && match.side === "final" && match.status === "completed")?.winner ?? null,
    higher: matches.find((match) => match.split === "higher" && match.side === "final" && match.status === "completed")?.winner ?? null,
  };
  return {
    tournament,
    mode,
    counts,
    caps: {
      lower: tournamentCapState(mode, counts.lower),
      higher: tournamentCapState(mode, counts.higher),
    },
    splitRanks: TOURNAMENT_SPLIT_RANKS,
    viewerEligibility: eligibility,
    viewerSignup,
    viewerTeam,
    viewerEliminated: Boolean(loss),
    currentMatch,
    teams,
    matches,
    mapPool,
    champions,
  };
}

export async function getTournamentsHome(viewerId: string | null) {
  const active = (await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM "Tournament" WHERE status='active' ORDER BY "startedAt" DESC NULLS LAST LIMIT 1`))[0];
  const scheduled = (await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM "Tournament" WHERE status='scheduled' AND "publishedAt" IS NOT NULL ORDER BY "scheduledAt" ASC LIMIT 1`))[0];
  const recent = !active ? (await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM "Tournament" WHERE status='completed' ORDER BY "completedAt" DESC NULLS LAST LIMIT 1`))[0] : null;
  return {
    active: active ? await getTournamentPublicState(active.id, viewerId) : null,
    scheduled: scheduled ? await getTournamentPublicState(scheduled.id, viewerId) : null,
    recent: recent ? await getTournamentPublicState(recent.id, viewerId) : null,
  };
}

export async function createTournament(input: { name: string; mode: TournamentMode; scheduledAt: Date; createdById: string }) {
  if (!input.name.trim()) throw new Error("Tournament name is required.");
  if (!asMode(input.mode)) throw new Error("Tournament mode is invalid.");
  if (!Number.isFinite(input.scheduledAt.getTime())) throw new Error("A valid tournament date is required.");
  const id = uid();
  await prisma.$executeRawUnsafe(`INSERT INTO "Tournament" (id,name,mode,"scheduledAt","createdById") VALUES ($1,$2,$3,$4,$5)`, id, input.name.trim(), input.mode, input.scheduledAt, input.createdById);
  return id;
}

export async function updateTournament(tournamentId: string, input: { name?: string; scheduledAt?: Date; mode?: TournamentMode }) {
  const tournament = await tournamentRow(tournamentId);
  if (!tournament || tournament.status !== "scheduled") throw new Error("Only scheduled tournaments can be edited.");
  const name = input.name?.trim() || tournament.name;
  const mode = input.mode ?? tournament.mode;
  const date = input.scheduledAt ?? new Date(tournament.scheduledAt);
  if (!asMode(mode) || !Number.isFinite(date.getTime())) throw new Error("Tournament settings are invalid.");
  await prisma.$executeRawUnsafe(`UPDATE "Tournament" SET name=$2,mode=$3,"scheduledAt"=$4,"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1`, tournamentId, name, mode, date);
  await prisma.$executeRawUnsafe(`DELETE FROM "TournamentMatch" WHERE "tournamentId"=$1`, tournamentId);
  await prisma.$executeRawUnsafe(`DELETE FROM "TournamentTeamMember" WHERE "tournamentId"=$1`, tournamentId);
  await prisma.$executeRawUnsafe(`DELETE FROM "TournamentTeam" WHERE "tournamentId"=$1`, tournamentId);
  await prisma.$executeRawUnsafe(`UPDATE "TournamentSignup" SET status='registered',"updatedAt"=CURRENT_TIMESTAMP WHERE "tournamentId"=$1 AND status<>'withdrawn'`, tournamentId);
}

export async function cancelTournament(tournamentId: string) {
  await prisma.$executeRawUnsafe(`UPDATE "Tournament" SET status='cancelled',"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1 AND status='scheduled'`, tournamentId);
}

export async function setSignupSplit(tournamentId: string, userId: string, split: TournamentSplit) {
  const tournament = await tournamentRow(tournamentId);
  if (!tournament || tournament.status !== "scheduled") throw new Error("Splits can only be edited before the tournament starts.");
  const mode = asMode(tournament.mode);
  if (!mode) throw new Error("Tournament mode is invalid.");
  const count = Number((await prisma.$queryRawUnsafe<Array<{ count: number }>>(`SELECT COUNT(*)::int AS count FROM "TournamentSignup" WHERE "tournamentId"=$1 AND split=$2 AND "userId"<>$3 AND status<>'withdrawn'`, tournamentId, split, userId))[0]?.count ?? 0);
  if (tournamentCapState(mode, count).full) throw new Error("That split is full.");
  await prisma.$executeRawUnsafe(`UPDATE "TournamentSignup" SET split=$3,"requestedSplit"=NULL,"splitRequestStatus"='approved',status='registered',"updatedAt"=CURRENT_TIMESTAMP WHERE "tournamentId"=$1 AND "userId"=$2`, tournamentId, userId, split);
}

export async function resolveSplitRequest(tournamentId: string, userId: string, approve: boolean) {
  const signup = (await prisma.$queryRawUnsafe<any[]>(`SELECT "requestedSplit" FROM "TournamentSignup" WHERE "tournamentId"=$1 AND "userId"=$2 AND "splitRequestStatus"='pending'`, tournamentId, userId))[0];
  if (!signup?.requestedSplit) throw new Error("No pending split request was found.");
  if (approve) await setSignupSplit(tournamentId, userId, signup.requestedSplit as TournamentSplit);
  else await prisma.$executeRawUnsafe(`UPDATE "TournamentSignup" SET "requestedSplit"=NULL,"splitRequestStatus"='denied',"updatedAt"=CURRENT_TIMESTAMP WHERE "tournamentId"=$1 AND "userId"=$2`, tournamentId, userId);
}

export async function setSignupPriority(tournamentId: string, userId: string, priority: boolean) {
  const tournament = await tournamentRow(tournamentId);
  if (!tournament || tournament.status !== "scheduled") throw new Error("Signup priority can only be edited before the tournament starts.");
  await prisma.$executeRawUnsafe(`UPDATE "TournamentSignup" SET priority=$3,"updatedAt"=CURRENT_TIMESTAMP WHERE "tournamentId"=$1 AND "userId"=$2`, tournamentId, userId, priority);
}

export async function addTournamentMap(tournamentId: string, split: TournamentSplit, mapId: string) {
  const tournament = await tournamentRow(tournamentId);
  if (!tournament || tournament.status !== "scheduled") throw new Error("Map pools can only be edited before the tournament starts.");
  const map = await prisma.challengeMap.findUnique({ where: { id: mapId }, select: { id: true, status: true, rating: true, reviewerNote: true } });
  if (!map || !isRankedMap(map.rating, map.reviewerNote, String(map.status))) throw new Error("Only ranked, approved maps can be added to tournament pools.");
  await prisma.$executeRawUnsafe(`INSERT INTO "TournamentMapPool" (id,"tournamentId",split,"mapId") VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`, uid(), tournamentId, split, mapId);
}

export async function removeTournamentMap(tournamentId: string, split: TournamentSplit, mapId: string) {
  const tournament = await tournamentRow(tournamentId);
  if (!tournament || tournament.status !== "scheduled") throw new Error("Map pools can only be edited before the tournament starts.");
  await prisma.$executeRawUnsafe(`DELETE FROM "TournamentMapPool" WHERE "tournamentId"=$1 AND split=$2 AND "mapId"=$3`, tournamentId, split, mapId);
}

export async function moveTournamentSeed(tournamentId: string, teamId: string, direction: -1 | 1) {
  const tournament = await tournamentRow(tournamentId);
  if (!tournament || tournament.status !== "scheduled") throw new Error("Seeds can only be changed before the tournament starts.");
  const team = (await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "TournamentTeam" WHERE id=$1 AND "tournamentId"=$2`, teamId, tournamentId))[0];
  if (!team) throw new Error("Tournament team not found.");
  const targetSeed = Number(team.seed) + direction;
  const other = (await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "TournamentTeam" WHERE "tournamentId"=$1 AND split=$2 AND seed=$3`, tournamentId, team.split, targetSeed))[0];
  if (!other) return;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`UPDATE "TournamentTeam" SET seed=-1 WHERE id=$1`, team.id);
    await tx.$executeRawUnsafe(`UPDATE "TournamentTeam" SET seed=$2 WHERE id=$1`, other.id, team.seed);
    await tx.$executeRawUnsafe(`UPDATE "TournamentTeam" SET seed=$2 WHERE id=$1`, team.id, targetSeed);
  });
  await reseedRoundOne(tournamentId, team.split);
}

export async function swapTournamentMembers(tournamentId: string, firstUserId: string, secondUserId: string) {
  const tournament = await tournamentRow(tournamentId);
  if (!tournament || tournament.status !== "scheduled") throw new Error("Players can only be moved before the tournament starts.");
  if (firstUserId === secondUserId) return;
  const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT tm.*,t.split FROM "TournamentTeamMember" tm JOIN "TournamentTeam" t ON t.id=tm."teamId" WHERE tm."tournamentId"=$1 AND tm."userId" IN ($2,$3)`, tournamentId, firstUserId, secondUserId);
  if (rows.length !== 2 || rows[0].split !== rows[1].split) throw new Error("Select two bracketed players from the same split.");
  const first = rows.find((row) => row.userId === firstUserId);
  const second = rows.find((row) => row.userId === secondUserId);
  if (!first || !second || first.teamId === second.teamId) return;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`UPDATE "TournamentTeamMember" SET "teamId"=$2,slot=$3 WHERE id=$1`, first.id, second.teamId, second.slot);
    await tx.$executeRawUnsafe(`UPDATE "TournamentTeamMember" SET "teamId"=$2,slot=$3 WHERE id=$1`, second.id, first.teamId, first.slot);
  });
  await refreshTeamAverage(first.teamId);
  await refreshTeamAverage(second.teamId);
  await reseedRoundOne(tournamentId, rows[0].split as TournamentSplit);
}

export async function forceTournamentWinner(tournamentMatchId: string, winnerTeamId: string) {
  const match = (await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "TournamentMatch" WHERE id=$1`, tournamentMatchId))[0];
  if (!match || ![match.team1Id, match.team2Id].includes(winnerTeamId)) throw new Error("Winner must be one of the teams in this match.");
  if (match.status === "completed") return;
  let scores: { one: number | null; two: number | null } | undefined;
  if (match.battleMatchId) {
    await prisma.$executeRawUnsafe(`UPDATE "BattleMatch" SET status='finished',"finishedAt"=COALESCE("finishedAt",CURRENT_TIMESTAMP) WHERE id=$1`, match.battleMatchId);
    scores = await battleScores(match.battleMatchId);
  }
  await advanceTournamentWinner(match, winnerTeamId, scores);
}

export async function getTournamentAdminState(tournamentId?: string | null) {
  const tournaments = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "Tournament" ORDER BY "createdAt" DESC LIMIT 30`);
  const selectedId = tournamentId && tournaments.some((row) => row.id === tournamentId) ? tournamentId : tournaments[0]?.id ?? null;
  if (!selectedId) return { tournaments, selected: null };
  const selected = await getTournamentPublicState(selectedId, null);
  const signups = await prisma.$queryRawUnsafe<any[]>(
    `SELECT s.*,u.username,u."displayName",u."profileHandle",u.rhp AS "currentRhp",u."discordId",u."inGuild",u."rhythiaVerified",rp.username AS "rhythiaUsername" FROM "TournamentSignup" s JOIN "User" u ON u.id=s."userId" LEFT JOIN "RhythiaProfile" rp ON rp."userId"=u.id WHERE s."tournamentId"=$1 ORDER BY s.split,s.priority DESC,s."signedUpAt" ASC`,
    selectedId,
  );
  const streamSignups = signups.filter((signup) => signup.streamOptIn && signup.status !== "withdrawn");
  const preflight = selected?.tournament?.status === "scheduled" ? await getTournamentPreflight(selectedId) : null;
  return { tournaments, selected: selected ? { ...selected, signups, streamSignups, preflight } : null };
}

export function tournamentRankSnapshot(rhp: number) {
  const rank = getRankInfo(rhp);
  return { ...rank, label: rankLabel(rank), split: splitForRhp(rhp) };
}

export { asMode as parseTournamentMode, asSplit as parseTournamentSplit, asStreamPlatform as parseTournamentStreamPlatform, asStreamIdentity as parseTournamentStreamIdentity };