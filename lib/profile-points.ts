import { prisma } from "@/lib/db";
import { getUserPointOverrides, syncUserModeScores, type ModePoints } from "@/lib/rhythia-mode-points";
import { reconcileStoredRhp } from "@/lib/rhp-reconcile";

export type ReliableModePoints = { points: ModePoints; rhp: number; source: "fresh" | "cached"; syncedAt: Date | null; warning: string | null };

const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000;

export async function getCachedModePoints(userId: string): Promise<ReliableModePoints> {
  const reconciled = await reconcileStoredRhp(userId).catch(() => null);
  const [user, rows, overrides, baselines] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { rhp: true, lastRhythiaRpCheckAt: true } }),
    prisma.rhythiaModeScore.findMany({ where: { userId }, select: { cameraMode: true, points: true } }),
    getUserPointOverrides(userId),
    prisma.$queryRawUnsafe<Array<{ rplBase: number; rpsBase: number; rpvBase: number }>>('SELECT "rplBase","rpsBase","rpvBase" FROM "RankingBaseline" WHERE "userId"=$1 LIMIT 1', userId),
  ]);
  const baseline = baselines[0] ?? { rplBase: 0, rpsBase: 0, rpvBase: 0 };
  const raw: ModePoints = { lock: 0, spin: 0, vr: 0 };
  for (const row of rows) raw[row.cameraMode] += Number(row.points) || 0;
  const points = {
    lock: overrides.get("rpl") ?? baseline.rplBase + raw.lock,
    spin: overrides.get("rps") ?? baseline.rpsBase + raw.spin,
    vr: overrides.get("rpv") ?? baseline.rpvBase + raw.vr,
  };
  return { points, rhp: reconciled?.rhp ?? overrides.get("rhp") ?? user?.rhp ?? 0, source: "cached", syncedAt: user?.lastRhythiaRpCheckAt ?? null, warning: null };
}

export async function syncHalfRhythiaRp(userId: string): Promise<ReliableModePoints> {
  const result = await syncUserModeScores(userId);
  const syncedAt = new Date();
  return { points: { lock: result.rpl, spin: result.rps, vr: result.rpv }, rhp: result.rhp, source: "fresh", syncedAt, warning: null };
}

export async function getReliableModePoints(userId: string, options: { forceRefresh?: boolean; maxAgeMs?: number } = {}): Promise<ReliableModePoints> {
  const cached = await getCachedModePoints(userId);
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const freshEnough = cached.syncedAt && Date.now() - cached.syncedAt.getTime() < maxAgeMs;
  if (!options.forceRefresh && freshEnough) return cached;
  try { return await syncHalfRhythiaRp(userId); }
  catch (error) { return { ...cached, warning: error instanceof Error ? error.message : "Rhythia could not be refreshed." }; }
}
