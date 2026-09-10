import { prisma } from "@/lib/db";
import { getRankInfo, rankTierBounds } from "@/lib/ranks";
import { calculateStoredTotals, syncUserModeScores } from "@/lib/rhythia-mode-points";
import type { ModeKey, ModePoints } from "@/lib/rhythia-mode-rules";

export const RANKING_CONFIG_KEY = "rankingConfigV3";
export type RankingConfig = { version: 3 };
export const DEFAULT_RANKING_CONFIG: RankingConfig = { version: 3 };

export function sanitizeRankingConfig(_value: unknown): RankingConfig { return DEFAULT_RANKING_CONFIG; }
export async function loadRankingConfig(): Promise<RankingConfig> { return DEFAULT_RANKING_CONFIG; }
export async function saveRankingConfig(_value: unknown) {
  await prisma.siteSetting.upsert({ where: { key: RANKING_CONFIG_KEY }, update: { value: JSON.stringify(DEFAULT_RANKING_CONFIG) }, create: { key: RANKING_CONFIG_KEY, value: JSON.stringify(DEFAULT_RANKING_CONFIG), description: "Rhythians analyzed-map pass-only ranking system." } });
  return DEFAULT_RANKING_CONFIG;
}

export function placementFloor(_globalRank: number | null | undefined, _config: RankingConfig) { return 0; }
export function initialOverallPlacement(_input: { globalRank?: number | null; rhythmPoints?: number | null }, _config: RankingConfig) { return 0; }
export function modeScale(_mode: ModeKey) { return 1; }
export function modeEquivalentRhp(points: number, _mode: ModeKey) { return Math.max(0, points); }
export function modePointsFromEquivalentRhp(rhp: number, _mode: ModeKey) { return Math.max(0, Math.round(rhp)); }
export function overallRhpFromModes(points: ModePoints, _overallFloor = 0, _config: RankingConfig = DEFAULT_RANKING_CONFIG) {
  return Math.max(0, Math.round(points.lock + points.spin + points.vr));
}
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
  oldRhp: number;
  newRhp: number;
  rpl: number;
  rps: number;
  rpv: number;
  battleSeed: number;
};

export async function previewRankingReset(_config: RankingConfig = DEFAULT_RANKING_CONFIG) {
  const users = await prisma.user.findMany({ where: { NOT: { profileHandle: "rhythia-imports" } }, select: { id: true, username: true, rhp: true }, orderBy: { username: "asc" } });
  const rows: RankingResetPreviewRow[] = [];
  for (const user of users) {
    const totals = await calculateStoredTotals(user.id);
    rows.push({ userId: user.id, username: user.username, oldRhp: user.rhp, newRhp: totals.rhp, rpl: totals.rpl, rps: totals.rps, rpv: totals.rpv, battleSeed: battleSeedForRhp(totals.rhp) });
  }
  return rows;
}

export async function clearRankingForFullRebuild() {
  await prisma.$transaction(async (tx) => {
    await tx.rhythiaModeScore.deleteMany({});
    await tx.$executeRawUnsafe('DELETE FROM "UserPointOverride"').catch(() => 0);
    await tx.user.updateMany({ where: { NOT: { profileHandle: "rhythia-imports" } }, data: { rhp: 0, scoreImportDone: false } });
  });
}

export async function rebuildRankingUsers(userIds: string[]) {
  const results: Array<{ userId: string; rpl: number; rpv: number; rps: number; rhp: number; ok: boolean; error?: string }> = [];
  for (const userId of userIds) {
    try {
      const totals = await syncUserModeScores(userId);
      results.push({ userId, rpl: totals.rpl, rpv: totals.rpv, rps: totals.rps, rhp: totals.rhp, ok: true });
    } catch (error) {
      results.push({ userId, rpl: 0, rpv: 0, rps: 0, rhp: 0, ok: false, error: error instanceof Error ? error.message : "Score sync failed." });
    }
  }
  return results;
}

export async function applyRankingReset(actorId: string, config: RankingConfig = DEFAULT_RANKING_CONFIG) {
  await clearRankingForFullRebuild();
  const users = await prisma.rhythiaProfile.findMany({ select: { userId: true } });
  const results = await rebuildRankingUsers(users.map((user) => user.userId));
  const preview = await previewRankingReset(config);
  const ids = await prisma.$queryRawUnsafe<Array<{ id: string }>>('SELECT gen_random_uuid()::text AS id');
  const resetId = ids[0]?.id ?? crypto.randomUUID();
  await prisma.moderationAction.create({ data: { actorId, action: "ranking_passes_full_rebuild", targetType: "ranking_system", targetId: resetId, metadata: { users: users.length, succeeded: results.filter((result) => result.ok).length, failed: results.filter((result) => !result.ok).length } } });
  return { resetId, users: users.length, preview, results };
}