import { prisma } from "@/lib/db";
import { getRankInfo } from "@/lib/ranks";
import { getMapAnalysis, analysisIsCurrent } from "@/lib/map-analysis-store";
import { syncUserModeScores } from "@/lib/rhythia-mode-points";

export async function checkRankedMap(userId: string, mapId: string) {
  const [map, source, beforeUser, beforeRows] = await Promise.all([
    prisma.challengeMap.findUnique({ where: { id: mapId }, select: { id: true, title: true, rating: true } }),
    prisma.challengeMap.findUnique({ where: { id: mapId }, select: { sourceBeatmapId: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { rhp: true } }),
    prisma.rhythiaModeScore.findMany({ where: { userId }, select: { mapKey: true, cameraMode: true } }),
  ]);
  if (!map || !beforeUser) return { status: "not_available" as const, points: 0 };
  const analysis = await getMapAnalysis(map.id);
  if (!analysisIsCurrent(analysis) || !analysis?.pointEligible || map.rating == null) return { status: "not_available" as const, points: 0 };
  const mapKey = source?.sourceBeatmapId != null ? `rhythia:${source.sourceBeatmapId}` : `map:${map.id}`;
  const beforeModes = new Set(beforeRows.filter((row) => row.mapKey === mapKey).map((row) => row.cameraMode));
  let result: Awaited<ReturnType<typeof syncUserModeScores>>;
  try { result = await syncUserModeScores(userId); } catch { return { status: "error" as const, points: 0 }; }
  const rows = result.rows.filter((row) => row.mapKey === mapKey);
  if (!rows.length) return { status: "not_beat" as const, points: 0, rankInfo: getRankInfo(result.rhp) };
  const best = rows.slice().sort((a, b) => b.points - a.points)[0];
  const newModeClear = rows.some((row) => !beforeModes.has(row.cameraMode));
  const gained = Math.max(0, result.rhp - beforeUser.rhp);
  return { status: newModeClear || gained > 0 ? "beat" as const : "already" as const, points: gained, accuracy: best.accuracy, rankInfo: getRankInfo(result.rhp) };
}

export async function checkAllRankedMaps(userId: string) {
  const [beforeRows, beforeUser] = await Promise.all([
    prisma.rhythiaModeScore.findMany({ where: { userId }, select: { mapKey: true, cameraMode: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { rhp: true } }),
  ]);
  if (!beforeUser) return { checked: 0, foundScores: 0, alreadyCompleted: 0, newlyCompleted: 0, totalPoints: 0, rankIndex: null };
  const before = new Set(beforeRows.map((row) => `${row.mapKey}:${row.cameraMode}`));
  const result = await syncUserModeScores(userId);
  const after = new Set(result.rows.map((row) => `${row.mapKey}:${row.cameraMode}`));
  let newlyCompleted = 0;
  for (const key of after) if (!before.has(key)) newlyCompleted += 1;
  const totalPoints = Math.max(0, result.rhp - beforeUser.rhp);
  return { checked: result.rows.length, foundScores: result.rows.length, alreadyCompleted: Math.max(0, result.rows.length - newlyCompleted), newlyCompleted, totalPoints, rankIndex: getRankInfo(result.rhp).index, rpl: result.rpl, rps: result.rps, rpv: result.rpv, rhp: result.rhp };
}
