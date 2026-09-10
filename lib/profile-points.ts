import { prisma } from "@/lib/db";
import { calculateStoredTotals, syncUserModeScores, type ModePoints } from "@/lib/rhythia-mode-points";
import { reconcileStoredRhp } from "@/lib/rhp-reconcile";

export type ReliableModePoints = { points: ModePoints; rhp: number; source: "fresh" | "cached"; syncedAt: Date | null; warning: string | null };

const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000;

export async function getCachedModePoints(userId: string): Promise<ReliableModePoints> {
  const [reconciled, user, totals] = await Promise.all([
    reconcileStoredRhp(userId).catch(() => null),
    prisma.user.findUnique({ where: { id: userId }, select: { rhp: true, lastRhythiaRpCheckAt: true } }),
    calculateStoredTotals(userId),
  ]);
  return { points: { lock: totals.rpl, spin: totals.rps, vr: totals.rpv }, rhp: reconciled?.rhp ?? totals.rhp ?? user?.rhp ?? 0, source: "cached", syncedAt: user?.lastRhythiaRpCheckAt ?? null, warning: null };
}

export async function syncPassRanking(userId: string): Promise<ReliableModePoints> {
  const result = await syncUserModeScores(userId);
  return { points: { lock: result.rpl, spin: result.rps, vr: result.rpv }, rhp: result.rhp, source: "fresh", syncedAt: new Date(), warning: null };
}

export async function getReliableModePoints(userId: string, options: { forceRefresh?: boolean; maxAgeMs?: number } = {}): Promise<ReliableModePoints> {
  const cached = await getCachedModePoints(userId);
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const freshEnough = cached.syncedAt && Date.now() - cached.syncedAt.getTime() < maxAgeMs;
  if (!options.forceRefresh && freshEnough) return cached;
  try { return await syncPassRanking(userId); }
  catch (error) { return { ...cached, warning: error instanceof Error ? error.message : "Rhythia scores could not be refreshed." }; }
}
