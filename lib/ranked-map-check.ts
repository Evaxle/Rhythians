import { prisma } from "@/lib/db";
import { getRankInfo } from "@/lib/ranks";
import { getMapAnalysis, analysisIsCurrent } from "@/lib/map-analysis-store";
import { syncUserModeScores } from "@/lib/rhythia-mode-points";

export async function checkRankedMap(userId: string, mapId: string) {
  const [map, before] = await Promise.all([
    prisma.challengeMap.findUnique({ where: { id: mapId }, select: { id: true, title: true, rating: true } }),
    prisma.rhythiaModeScore.findMany({ where: { userId }, select: { mapKey: true, points: true } }),
  ]);
  if (!map) return { status: "not_available" as const, points: 0 };
  const analysis = await getMapAnalysis(map.id);
  if (!analysisIsCurrent(analysis) || !analysis?.pointEligible || map.rating == null) return { status: "not_available" as const, points: 0 };
  const key = map.id;
  const source = await prisma.challengeMap.findUnique({ where: { id: map.id }, select: { sourceBeatmapId: true } });
  const mapKey = source?.sourceBeatmapId != null ? `rhythia:${source.sourceBeatmapId}` : `map:${key}`;
  const oldContribution = Math.max(0, ...before.filter((row) => row.mapKey === mapKey).map((row) => row.points));
  let result: Awaited<ReturnType<typeof syncUserModeScores>>;
  try { result = await syncUserModeScores(userId); } catch { return { status: "error" as const, points: 0 }; }
  const rows = result.rows.filter((row) => row.mapKey === mapKey);
  if (!rows.length) return { status: "not_beat" as const, points: 0, rankInfo: getRankInfo(result.rhp) };
  const best = rows.slice().sort((a, b) => b.points - a.points)[0];
  const contribution = best.points;
  const gained = Math.max(0, contribution - oldContribution);
  return { status: gained > 0 ? "beat" as const : "already" as const, points: gained, accuracy: best.accuracy, rankInfo: getRankInfo(result.rhp) };
}

export async function checkAllRankedMaps(userId: string) {
  const beforeRows = await prisma.rhythiaModeScore.findMany({ where: { userId }, select: { mapKey: true, points: true } });
  const before = new Map<string, number>();
  for (const row of beforeRows) before.set(row.mapKey, Math.max(before.get(row.mapKey) ?? 0, row.points));
  const result = await syncUserModeScores(userId);
  const after = new Map<string, number>();
  for (const row of result.rows) after.set(row.mapKey, Math.max(after.get(row.mapKey) ?? 0, row.points));
  let newlyCompleted = 0;
  let totalPoints = 0;
  for (const [key, points] of after) {
    const old = before.get(key) ?? 0;
    if (old === 0 && points > 0) newlyCompleted += 1;
    if (points > old) totalPoints += points - old;
  }
  return { checked: after.size, foundScores: after.size, alreadyCompleted: Math.max(0, after.size - newlyCompleted), newlyCompleted, totalPoints, rankIndex: getRankInfo(result.rhp).index, rpl: result.rpl, rps: result.rps, rpv: result.rpv, rhp: result.rhp };
}
