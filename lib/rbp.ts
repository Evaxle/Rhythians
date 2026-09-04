import { prisma } from "@/lib/db";
import { RANKS, getRankInfo } from "@/lib/ranks";
import { getSeasonalPath } from "@/lib/seasonal-path";
import { teamScore } from "@/lib/battles";
import type { Prisma } from "@/generated/prisma/client";

export const RBP_MAX_WIN = 30;
export const RBP_MAX_LOSS = 20;
export const RBP_FORFEIT = 10;
export const RBP_SUBMIT_BONUS = 10;

async function ensurePathSeason() {
  try { await getSeasonalPath(); } catch {}
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; seasonNumber: number; startsAt: Date; endsAt: Date }>>('SELECT "id","seasonNumber","startsAt","endsAt" FROM "SeasonalPathSeason" WHERE "startsAt" <= CURRENT_TIMESTAMP AND "endsAt" > CURRENT_TIMESTAMP ORDER BY "seasonNumber" DESC LIMIT 1');
  return rows[0] ?? null;
}

async function finalizeRbpSeasons() {
  const expired = await prisma.$queryRawUnsafe<Array<{ id: string; seasonNumber: number }>>('SELECT "id","seasonNumber" FROM "RbpSeason" WHERE "endsAt" <= CURRENT_TIMESTAMP AND "finalizedAt" IS NULL ORDER BY "seasonNumber" ASC');
  for (const season of expired) {
    const players = await prisma.$queryRawUnsafe<Array<{ userId: string; rbp: number }>>('SELECT "userId","rbp" FROM "RbpUserSeason" WHERE "seasonId" = $1', season.id);
    for (const player of players) {
      const finalRank = getRankInfo(player.rbp).index;
      for (let rankIndex = 0; rankIndex <= finalRank; rankIndex += 1) {
        const rank = RANKS[rankIndex];
        if (!rank) continue;
        const slug = `season-${season.seasonNumber}-battles-${rank.name.toLowerCase()}`;
        const name = `Season ${season.seasonNumber} Battles ${rank.name}`;
        const tag = await prisma.tag.upsert({ where: { slug }, update: { name }, create: { slug, name } });
        await prisma.userTag.upsert({ where: { userId_tagId: { userId: player.userId, tagId: tag.id } }, update: {}, create: { userId: player.userId, tagId: tag.id, source: "manual" } });
      }
    }
    await prisma.$executeRawUnsafe('UPDATE "RbpSeason" SET "finalizedAt" = CURRENT_TIMESTAMP WHERE "id" = $1 AND "finalizedAt" IS NULL', season.id);
  }
}

export async function getCurrentRbpSeason() {
  await finalizeRbpSeasons();
  const pathSeason = await ensurePathSeason();
  if (!pathSeason) return null;
  const existing = await prisma.$queryRawUnsafe<Array<{ id: string; seasonNumber: number; startsAt: Date; endsAt: Date; finalizedAt: Date | null }>>('SELECT "id","seasonNumber","startsAt","endsAt","finalizedAt" FROM "RbpSeason" WHERE "seasonNumber" = $1 LIMIT 1', pathSeason.seasonNumber);
  if (existing[0]) return existing[0];
  await prisma.$executeRawUnsafe('INSERT INTO "RbpSeason" ("id","seasonNumber","startsAt","endsAt") VALUES (gen_random_uuid(),$1,$2,$3) ON CONFLICT ("seasonNumber") DO NOTHING', pathSeason.seasonNumber, pathSeason.startsAt, pathSeason.endsAt);
  return getCurrentRbpSeason();
}

export async function ensureUserRbpSeason(userId: string) {
  const season = await getCurrentRbpSeason();
  if (!season) return null;
  const existing = await prisma.$queryRawUnsafe<Array<{ id: string; rbp: number; placementRankIndex: number }>>('SELECT "id","rbp","placementRankIndex" FROM "RbpUserSeason" WHERE "seasonId"=$1 AND "userId"=$2 LIMIT 1', season.id, userId);
  if (existing[0]) return { season, player: existing[0] };
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { rhp: true } });
  if (!user) return null;
  const normalRank = getRankInfo(user.rhp).index;
  const placementRankIndex = Math.max(0, normalRank - 1);
  const startingRbp = RANKS[placementRankIndex]?.minRhp ?? 0;
  await prisma.$executeRawUnsafe('INSERT INTO "RbpUserSeason" ("id","seasonId","userId","placementRankIndex","rbp") VALUES (gen_random_uuid(),$1,$2,$3,$4) ON CONFLICT ("seasonId","userId") DO NOTHING', season.id, userId, placementRankIndex, startingRbp);
  const player = await prisma.$queryRawUnsafe<Array<{ id: string; rbp: number; placementRankIndex: number }>>('SELECT "id","rbp","placementRankIndex" FROM "RbpUserSeason" WHERE "seasonId"=$1 AND "userId"=$2 LIMIT 1', season.id, userId);
  return player[0] ? { season, player: player[0] } : null;
}

export function rbpDeltaFromAccuracyDifference(winnerAccuracy: number, loserAccuracy: number) {
  const difference = Math.max(0, winnerAccuracy - loserAccuracy);
  const bucket = Math.min(4, Math.max(1, Math.floor(difference)));
  return { win: 26 + bucket, loss: 16 + bucket, difference };
}

async function insertResult(tx: Prisma.TransactionClient, input: { seasonId: string; matchId: string; userId: string; opponentUserId: string | null; result: string; delta: number; accuracy: number | null; opponentAccuracy: number | null; reason: string | null }) {
  return tx.$queryRawUnsafe<Array<{ id: string }>>('INSERT INTO "RbpMatchResult" ("id","seasonId","matchId","userId","opponentUserId","result","delta","accuracy","opponentAccuracy","reason") VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT ("seasonId","matchId","userId") DO NOTHING RETURNING "id"', input.seasonId, input.matchId, input.userId, input.opponentUserId, input.result, input.delta, input.accuracy, input.opponentAccuracy, input.reason);
}

export async function grantRbpSubmitBonus(_matchId: string, _userId: string) { return false; }

export async function resolveFinishedRbpMatch(matchId: string, forcedWinnerTeam: number | null = null, reason: string | null = null) {
  const match = await prisma.$queryRawUnsafe<Array<{ id: string; matchType: string; status: string }>>('SELECT "id","matchType","status" FROM "BattleMatch" WHERE "id"=$1 LIMIT 1', matchId);
  if (!match[0] || match[0].matchType !== "ranked" || match[0].status !== "finished") return null;
  const season = await getCurrentRbpSeason();
  if (!season) return null;
  const players = await prisma.$queryRawUnsafe<Array<{ userId: string; team: number; accuracy: number | null }>>('SELECT "userId","team","accuracy" FROM "BattleMatchPlayer" WHERE "matchId"=$1 ORDER BY "team","userId"', matchId);
  if (!players.length || !players.some((player) => player.accuracy != null)) return null;
  const scoreOne = teamScore(players.filter((p) => p.team === 1).map((p) => p.accuracy), "regular");
  const scoreTwo = teamScore(players.filter((p) => p.team === 2).map((p) => p.accuracy), "regular");
  let winnerTeam = forcedWinnerTeam ?? 0;
  if (forcedWinnerTeam == null) winnerTeam = scoreOne == null ? (scoreTwo == null ? 0 : 2) : scoreTwo == null ? 1 : scoreOne === scoreTwo ? 0 : scoreOne > scoreTwo ? 1 : 2;
  await prisma.$transaction(async (tx) => {
    for (const player of players) {
      const own = player.team === 1 ? scoreOne : scoreTwo;
      const opponent = player.team === 1 ? scoreTwo : scoreOne;
      const opponentPlayer = players.find((candidate) => candidate.team !== player.team) ?? null;
      const userSeason = await tx.$queryRawUnsafe<Array<{ id: string }>>('SELECT "id" FROM "RbpUserSeason" WHERE "seasonId"=$1 AND "userId"=$2 LIMIT 1', season.id, player.userId);
      if (!userSeason[0]) continue;
      const result = winnerTeam === 0 ? "draw" : player.team === winnerTeam ? "win" : "loss";
      let delta = 0;
      if (winnerTeam !== 0 && reason !== "timeout") {
        const a = Math.max(0, own ?? 0);
        const b = Math.max(0, opponent ?? 0);
        const deltas = player.team === winnerTeam ? rbpDeltaFromAccuracyDifference(a, b) : rbpDeltaFromAccuracyDifference(b, a);
        delta = result === "win" ? deltas.win : -deltas.loss;
      }
      const inserted = await insertResult(tx, { seasonId: season.id, matchId, userId: player.userId, opponentUserId: opponentPlayer?.userId ?? null, result, delta, accuracy: player.accuracy, opponentAccuracy: opponent, reason });
      if (!inserted.length) continue;
      if (delta) await tx.$executeRawUnsafe('UPDATE "RbpUserSeason" SET "rbp"=GREATEST(0,"rbp"+$1),"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$2', delta, userSeason[0].id,);
    }
  });
  return { winnerTeam, scoreOne, scoreTwo };
}

export async function forfeitRbpMatch(matchId: string, userId: string, matchStatus = "active") {
  const match = await prisma.$queryRawUnsafe<Array<{ id: string; matchType: string; status: string }>>('SELECT "id","matchType","status" FROM "BattleMatch" WHERE "id"=$1 LIMIT 1', matchId);
  if (!match[0] || match[0].matchType !== "ranked" || match[0].status !== matchStatus) return { ok: false };
  const players = await prisma.$queryRawUnsafe<Array<{ userId: string; team: number; accuracy: number | null }>>('SELECT "userId","team","accuracy" FROM "BattleMatchPlayer" WHERE "matchId"=$1 ORDER BY "team","userId"', matchId);
  if (!players.some((player) => player.userId === userId)) return { ok: false };
  const season = await getCurrentRbpSeason();
  if (!season) return { ok: false };
  const leaver = players.find((player) => player.userId === userId);
  if (!leaver) return { ok: false };
  await prisma.$transaction(async (tx) => {
    const updated = await tx.$executeRawUnsafe('UPDATE "BattleMatch" SET "status"=\'finished\',"finishedAt"=CURRENT_TIMESTAMP,"responseDeadlineAt"=NULL WHERE "id"=$1 AND "status"=\'active\'', matchId);
    if (!updated) return;
    for (const player of players) {
      const isLeaver = player.userId === userId;
      const delta = isLeaver ? -RBP_FORFEIT : RBP_FORFEIT;
      const result = isLeaver ? "forfeit" : "win";
      const reason = isLeaver ? "unsportsmanlike" : "opponent_forfeit";
      const opponent = players.find((candidate) => candidate.userId !== player.userId) ?? null;
      const userSeason = await tx.$queryRawUnsafe<Array<{ id: string }>>('SELECT "id" FROM "RbpUserSeason" WHERE "seasonId"=$1 AND "userId"=$2 LIMIT 1', season.id, player.userId);
      if (!userSeason[0]) continue;
      const inserted = await insertResult(tx, { seasonId: season.id, matchId, userId: player.userId, opponentUserId: opponent?.userId ?? null, result, delta, accuracy: player.accuracy, opponentAccuracy: opponent?.accuracy ?? null, reason });
      if (!inserted.length) continue;
      await tx.$executeRawUnsafe('UPDATE "RbpUserSeason" SET "rbp"=GREATEST(0,"rbp"+$1),"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$2', delta, userSeason[0].id);
    }
  });
  return { ok: true, delta: -RBP_FORFEIT, winningTeam: leaver.team === 1 ? 2 : 1 };
}

export async function getRbpProfile(userId: string) {
  const row = await ensureUserRbpSeason(userId);
  if (!row) return null;
  return { ...row, rank: getRankInfo(row.player.rbp) };
}

export async function getRbpRecent(userId: string, limit = 6) {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; result: string; delta: number; accuracy: number | null; opponentAccuracy: number | null; reason: string | null; createdAt: Date; opponentUsername: string | null; opponentDisplayName: string | null; opponentHandle: string | null; mode: string }>>('SELECT r.id,r.result,r.delta,r.accuracy,r."opponentAccuracy",r."reason",r."createdAt",u.username AS "opponentUsername",u."displayName" AS "opponentDisplayName",u."profileHandle" AS "opponentHandle",bm.mode FROM "RbpMatchResult" r LEFT JOIN "User" u ON u.id=r."opponentUserId" JOIN "BattleMatch" bm ON bm.id=r."matchId" WHERE r."userId"=$1 ORDER BY r."createdAt" DESC LIMIT $2', userId, limit);
  return rows.map((row) => ({ ...row, mode: String(row.mode).split(":")[0], opponentName: row.opponentDisplayName ?? row.opponentUsername ?? "Opponent" }));
}

export async function getRbpLeaderboards(limit = 100) {
  const season = await getCurrentRbpSeason();
  if (!season) return { season: null, global: [], ranks: RANKS.map(() => []) };
  const global = await prisma.$queryRawUnsafe<Array<any>>('SELECT r."userId",u."username",u."displayName",u."profileHandle",u."avatar",r."rbp",r."placementRankIndex" FROM "RbpUserSeason" r JOIN "User" u ON u.id=r."userId" WHERE r."seasonId"=$1 AND u."profileHandle" <> \'rhythia-imports\' ORDER BY r."rbp" DESC,u."username" ASC LIMIT $2', season.id, limit);
  const rankedGlobal = global.map((row, index) => ({ ...row, position: index + 1, rank: getRankInfo(row.rbp) }));
  const ranks = await Promise.all(RANKS.map(async (rank, rankIndex) => {
    const min = rank.minRhp;
    const max = rankIndex < RANKS.length - 1 ? RANKS[rankIndex + 1].minRhp : null;
    const rows = await prisma.$queryRawUnsafe<Array<any>>(`SELECT r."userId",u."username",u."displayName",u."profileHandle",u."avatar",r."rbp",r."placementRankIndex" FROM "RbpUserSeason" r JOIN "User" u ON u.id=r."userId" WHERE r."seasonId"=$1 AND r."rbp">=$2 ${max == null ? "" : "AND r.\"rbp\"<$3"} AND u."profileHandle" <> 'rhythia-imports' ORDER BY r."rbp" DESC,u."username" ASC LIMIT $${max == null ? 3 : 4}`, ...(max == null ? [season.id, min, limit] : [season.id, min, max, limit]));
    return rows.map((row, index) => ({ ...row, position: index + 1, rank: getRankInfo(row.rbp) }));
  }));
  return { season, global: rankedGlobal, ranks };
}
