import { prisma } from "@/lib/db";
import { getUserPointOverrides, type ModePoints } from "@/lib/rhythia-mode-points";

export type ReliableModePoints = { points: ModePoints; rhp: number; source: "fresh" | "cached"; syncedAt: Date | null; warning: string | null };

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

export async function getReliableModePoints(userId: string, _options: { forceRefresh?: boolean; maxAgeMs?: number } = {}): Promise<ReliableModePoints> {
  return getCachedModePoints(userId);
}
