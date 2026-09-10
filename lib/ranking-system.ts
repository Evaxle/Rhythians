import { prisma } from "@/lib/db";
import { getRankInfo, rankTierBounds } from "@/lib/ranks";
import { calculateStoredTotals, reconcileUserRankPoints } from "@/lib/rhythia-mode-points";
import type { ModeKey, ModePoints } from "@/lib/rhythia-mode-rules";

export const RANKING_CONFIG_KEY = "rankingConfigV3";
export type RankingConfig = { version: 3 };
export const DEFAULT_RANKING_CONFIG: RankingConfig = { version: 3 };

export function sanitizeRankingConfig(_value: unknown): RankingConfig { return DEFAULT_RANKING_CONFIG; }
export async function loadRankingConfig(): Promise<RankingConfig> { return DEFAULT_RANKING_CONFIG; }
export async function saveRankingConfig(_value: unknown) {
  await prisma.siteSetting.upsert({ where: { key: RANKING_CONFIG_KEY }, update: { value: JSON.stringify(DEFAULT_RANKING_CONFIG) }, create: { key: RANKING_CONFIG_KEY, value: JSON.stringify(DEFAULT_RANKING_CONFIG), description: "Rhythians analyzed-map ranking system version." } });
  return DEFAULT_RANKING_CONFIG;
}

export function placementFloor(_globalRank: number | null | undefined, _config: RankingConfig) { return 0; }
export function initialOverallPlacement(_input: { globalRank?: number | null; rhythmPoints?: number | null }, _config: RankingConfig) { return 0; }
export function modeScale(_mode: ModeKey) { return 1; }
export function modeEquivalentRhp(points: number, _mode: ModeKey) { return Math.max(0, points); }
export function modePointsFromEquivalentRhp(rhp: number, _mode: ModeKey) { return Math.max(0, Math.round(rhp)); }
export function overallRhpFromModes(points: ModePoints, _overallFloor: number, _config: RankingConfig) { return Math.max(0, Math.round(points.lock) + Math.round(points.spin) + Math.round(points.vr)); }
export function fallbackModeTarget(_overallPlacement: number, _mode: ModeKey, _config: RankingConfig) { return 0; }
export async function ensureRankingBaseline(_userId: string) { return { overallFloor: 0, rplBase: 0, rpsBase: 0, rpvBase: 0 }; }

export function battleSeedForRhp(rhp: number) {
  const info = getRankInfo(rhp);
  if (info.index === 0 && info.tier === 1) return 0;
  if (info.tier > 1) return rankTierBounds(info.index, info.tier - 1).start;
  const previousIndex = Math.max(0, info.index - 1);
  return rankTierBounds(previousIndex, 5).start;
}

export type RankingResetPreviewRow = {
  userId: string;
  username: string;
  globalRank: number | null;
  rhythmPoints: number;
  oldRhp: number;
  newRhp: number;
  rpl: number;
  rps: number;
  rpv: number;
  battleSeed: number;
};

export async function previewRankingReset(_config: RankingConfig = DEFAULT_RANKING_CONFIG) {
  const users = await prisma.user.findMany({ where: { NOT: { profileHandle: "rhythia-imports" } }, select: { id: true, username: true, rhp: true, rhythiaProfile: { select: { globalRank: true, rhythmPoints: true } } }, orderBy: { username: "asc" } });
  const rows: RankingResetPreviewRow[] = [];
  for (const user of users) {
    const totals = await calculateStoredTotals(user.id);
    rows.push({ userId: user.id, username: user.username, globalRank: user.rhythiaProfile?.globalRank ?? null, rhythmPoints: user.rhythiaProfile?.rhythmPoints ?? 0, oldRhp: user.rhp, newRhp: totals.rhp, rpl: totals.rpl, rps: totals.rps, rpv: totals.rpv, battleSeed: battleSeedForRhp(totals.rhp) });
  }
  return rows;
}

export async function applyRankingReset(actorId: string, config: RankingConfig = DEFAULT_RANKING_CONFIG) {
  const preview = await previewRankingReset(config);
  await prisma.$executeRawUnsafe('DELETE FROM "RankingBaseline"').catch(() => 0);
  for (const row of preview) await reconcileUserRankPoints(row.userId);
  const ids = await prisma.$queryRawUnsafe<Array<{ id: string }>>('SELECT gen_random_uuid()::text AS id');
  const resetId = ids[0]?.id ?? crypto.randomUUID();
  await prisma.moderationAction.create({ data: { actorId, action: "ranking_v3_recalculated", targetType: "ranking_system", targetId: resetId, metadata: { users: preview.length } } });
  return { resetId, users: preview.length, preview };
}
