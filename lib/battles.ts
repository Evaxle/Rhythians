import { prisma } from "@/lib/db";
import { getAvatarUrl } from "@/lib/avatar";
import { getRankInfo } from "@/lib/ranks";

export const BATTLE_MODES = ["1v1", "2v2", "3v3", "15v15"] as const;
export const TEAM_MODES = ["regular", "captains"] as const;
export type BattleMode = typeof BATTLE_MODES[number];
export type TeamMode = typeof TEAM_MODES[number];

export function isBattleMode(value: string): value is BattleMode { return BATTLE_MODES.includes(value as BattleMode); }
export function isTeamMode(value: string): value is TeamMode { return TEAM_MODES.includes(value as TeamMode); }
export function playerCount(mode: BattleMode) { return Number(mode.split("v")[0]); }
export function rankKey(rhp: number) { const rank = getRankInfo(rhp); return `${rank.index}:${rank.tier}`; }
export function teamScore(scores: Array<number | null>, mode: TeamMode) { const values = scores.filter((score): score is number => score != null && Number.isFinite(score)); if (!values.length) return null; return mode === "captains" ? Math.max(...values) : values.reduce((sum, score) => sum + score, 0) / values.length; }
export function rankedLoss(winnerScore: number, loserScore: number) { const difference = Math.max(0, winnerScore - loserScore); return Math.max(10, Math.min(20, Math.round(10 + Math.min(1, difference / 100) * 10))); }
export async function getBattleUser(userId: string) { const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true, displayName: true, profileHandle: true, avatar: true, discordId: true, rhp: true, userTags: { select: { tag: { select: { name: true, slug: true } } } } } }); if (!user) return null; return { ...user, avatar: getAvatarUrl(user, 256) }; }
export function rankTierValue(rhp: number) { const rank = getRankInfo(rhp); return rank.index * 5 + Math.max(0, rank.tier - 1); }
export function averageRankTier(rhps: number[]) { if (!rhps.length) return 0; return Math.round(rhps.reduce((sum, rhp) => sum + rankTierValue(rhp), 0) / rhps.length); }
export function rankIndexFromTierValue(value: number) { return Math.max(0, Math.min(8, Math.floor(Math.max(0, value) / 5))); }
export function casualRanksCompatible(rhps: number[]) { if (!rhps.length) return false; const ranks = rhps.map((rhp) => getRankInfo(rhp).index); return Math.max(...ranks) - Math.min(...ranks) <= 1; }

async function randomMaps(status: "approved" | "legacy", minRating: number, maxRating: number, maxLength: number | null, excluded: string[] = []) {
  const params: unknown[] = [status, minRating, maxRating];
  let sql = `SELECT id,title,artist,rating,length,"mapFileUrl","imageUrl" FROM "ChallengeMap" WHERE status::text=$1 AND rating IS NOT NULL AND rating >= $2 AND rating <= $3`;
  if (maxLength != null) { params.push(maxLength); sql += ` AND (length IS NULL OR length <= $4)`; }
  if (excluded.length) { params.push(excluded); sql += ` AND id <> ALL($${params.length}::text[])`; }
  sql += " ORDER BY RANDOM() LIMIT 80";
  return prisma.$queryRawUnsafe<any[]>(sql, ...params);
}

export async function selectBattleMap(rankIndex: number, maxLength: number | null = 240, excluded: string[] = []) {
  const rank = getRankInfo(Math.max(0, Math.min(8, rankIndex)) * 500);
  const preferredStatus: "approved" | "legacy" = Math.random() < 0.5 ? "approved" : "legacy";
  let maps = await randomMaps(preferredStatus, rank.rangeMin, rank.rangeMax, maxLength, excluded);
  if (!maps.length) maps = await randomMaps(preferredStatus === "approved" ? "legacy" : "approved", rank.rangeMin, rank.rangeMax, maxLength, excluded);
  if (!maps.length) {
    const params: unknown[] = [rank.rangeMin, rank.rangeMax];
    let sql = `SELECT id,title,artist,rating,length,"mapFileUrl","imageUrl" FROM "ChallengeMap" WHERE status::text IN ('approved','legacy') AND rating IS NOT NULL AND rating >= $1 AND rating <= $2`;
    if (maxLength != null) { params.push(maxLength); sql += ` AND (length IS NULL OR length <= $3)`; }
    if (excluded.length) { params.push(excluded); sql += ` AND id <> ALL($${params.length}::text[])`; }
    sql += " ORDER BY RANDOM() LIMIT 80";
    maps = await prisma.$queryRawUnsafe<any[]>(sql, ...params);
  }
  return maps[Math.floor(Math.random() * maps.length)] ?? null;
}
