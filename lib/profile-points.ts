import { prisma } from "@/lib/db";
import { getUserPointOverrides, syncUserModeScores, type ModePoints } from "@/lib/rhythia-mode-points";

export type ReliableModePoints = {
  points: ModePoints;
  rhp: number;
  source: "fresh" | "cached";
  syncedAt: Date | null;
  warning: string | null;
};

export async function getCachedModePoints(userId: string): Promise<ReliableModePoints> {
  const [user, rows, overrides] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { rhp: true, lastRhythiaRpCheckAt: true } }),
    prisma.rhythiaModeScore.findMany({ where: { userId }, select: { cameraMode: true, points: true } }),
    getUserPointOverrides(userId),
  ]);

  const raw: ModePoints = { lock: 0, spin: 0, vr: 0 };
  for (const row of rows) raw[row.cameraMode] += Number(row.points) || 0;

  return {
    points: {
      lock: overrides.get("rpl") ?? raw.lock,
      spin: overrides.get("rps") ?? raw.spin,
      vr: overrides.get("rpv") ?? raw.vr,
    },
    rhp: overrides.get("rhp") ?? user?.rhp ?? 0,
    source: "cached",
    syncedAt: user?.lastRhythiaRpCheckAt ?? null,
    warning: null,
  };
}

export async function getReliableModePoints(userId: string, options: { forceRefresh?: boolean; maxAgeMs?: number } = {}): Promise<ReliableModePoints> {
  const maxAgeMs = options.maxAgeMs ?? 120_000;
  const [profile, cached] = await Promise.all([
    prisma.rhythiaProfile.findUnique({ where: { userId }, select: { profileId: true } }),
    getCachedModePoints(userId),
  ]);

  if (!profile) return cached;
  const isFreshEnough = cached.syncedAt != null && Date.now() - cached.syncedAt.getTime() < maxAgeMs;
  if (!options.forceRefresh && isFreshEnough) return cached;

  try {
    const fresh = await syncUserModeScores(userId);
    return {
      points: { lock: fresh.rpl, spin: fresh.rps, vr: fresh.rpv },
      rhp: fresh.rhp,
      source: "fresh",
      syncedAt: new Date(),
      warning: null,
    };
  } catch (error) {
    return {
      ...cached,
      warning: error instanceof Error ? error.message : "Rhythia score sync failed; showing the last saved values.",
    };
  }
}
