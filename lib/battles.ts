import { prisma } from "@/lib/db";
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
export async function getBattleUser(userId: string) { return prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true, displayName: true, profileHandle: true, avatar: true, rhp: true, userTags: { select: { tag: { select: { name: true, slug: true } } } } } }); }
export async function selectBattleMap(rankIndex: number) {
  const rank = getRankInfo(rankIndex * 500);
  const maps = await prisma.$queryRawUnsafe<any[]>(`SELECT id,title,artist,rating,length,"mapFileUrl","imageUrl" FROM "ChallengeMap" WHERE status IN ('approved','legacy') AND rating >= $1 AND rating <= $2 ORDER BY "updatedAt" DESC LIMIT 50`, rank.rangeMin, rank.rangeMax);
  return maps[Math.floor(Math.random() * maps.length)] ?? null;
}
