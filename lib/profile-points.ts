import { prisma } from "@/lib/db";
import { fetchReliableRhythiaModeRp } from "@/lib/rhythia-mode-rp";
import { getUserPointOverrides, setUserPointOverride, type ModePoints } from "@/lib/rhythia-mode-points";

export type ReliableModePoints = { points: ModePoints; rhp: number; source: "fresh" | "cached"; syncedAt: Date | null; warning: string | null };

const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000;

export async function getCachedModePoints(userId: string): Promise<ReliableModePoints> {
  const [user, rows, overrides] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { rhp: true, lastRhythiaRpCheckAt: true } }),
    prisma.rhythiaModeScore.findMany({ where: { userId }, select: { cameraMode: true, points: true } }),
    getUserPointOverrides(userId),
  ]);
  const raw: ModePoints = { lock: 0, spin: 0, vr: 0 };
  for (const row of rows) raw[row.cameraMode] += Number(row.points) || 0;
  return { points: { lock: overrides.get("rpl") ?? raw.lock, spin: overrides.get("rps") ?? raw.spin, vr: overrides.get("rpv") ?? raw.vr }, rhp: overrides.get("rhp") ?? user?.rhp ?? 0, source: "cached", syncedAt: user?.lastRhythiaRpCheckAt ?? null, warning: null };
}

export async function syncHalfRhythiaRp(userId: string): Promise<ReliableModePoints> {
  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId }, select: { profileId: true } });
  if (!profile) return getCachedModePoints(userId);
  const source = await fetchReliableRhythiaModeRp(profile.profileId);
  const points: ModePoints = {
    lock: Math.round(source.lock / 2),
    spin: Math.round(source.spin / 2),
    vr: Math.round(source.vr / 2),
  };
  const rhp = points.lock + points.spin + points.vr;
  const syncedAt = new Date();
  await Promise.all([
    setUserPointOverride(userId, "rpl", points.lock),
    setUserPointOverride(userId, "rps", points.spin),
    setUserPointOverride(userId, "rpv", points.vr),
    setUserPointOverride(userId, "rhp", rhp),
  ]);
  await prisma.user.update({ where: { id: userId }, data: { rhp, lastRhythiaRpCheckAt: syncedAt } });
  return { points, rhp, source: "fresh", syncedAt, warning: null };
}

export async function getReliableModePoints(userId: string, options: { forceRefresh?: boolean; maxAgeMs?: number } = {}): Promise<ReliableModePoints> {
  const cached = await getCachedModePoints(userId);
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const freshEnough = cached.syncedAt && Date.now() - cached.syncedAt.getTime() < maxAgeMs;
  if (!options.forceRefresh && freshEnough) return cached;
  try {
    return await syncHalfRhythiaRp(userId);
  } catch (error) {
    return { ...cached, warning: error instanceof Error ? error.message : "Rhythia could not be refreshed." };
  }
}
