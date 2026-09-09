import { prisma } from "@/lib/db";
import { roundRating, type RankInfo, RANKS } from "@/lib/ranks";
import { analyzeChallengeMap, ensureMapAnalysisTable, MAP_ANALYZER_VERSION } from "@/lib/map-analysis-store";
import { checkAllRankedMaps, checkRankedMap } from "@/lib/ranked-map-check";

export async function submitChallengeMap(data: { id?: string; title: string; artist: string | null; description: string | null; mapFileUrl: string; imageUrl: string | null; requestedRating: number; mapperName: string | null; noteCount: number | null; length: number | null; submittedById: string; sourceBeatmapId?: number | null; sourceUrl?: string | null; isAutoImported?: boolean }) {
  const requestedRating = roundRating(Math.max(0, Number(data.requestedRating) || 0));
  return prisma.challengeMap.create({ data: { id: data.id, title: data.title.trim(), artist: data.artist?.trim() || null, description: data.description?.trim() || null, mapFileUrl: data.mapFileUrl, imageUrl: data.imageUrl, requestedRating, rating: null, mapperName: data.mapperName?.trim() || null, noteCount: data.noteCount, length: data.length, submittedById: data.submittedById, sourceBeatmapId: data.sourceBeatmapId ?? null, sourceUrl: data.sourceUrl ?? null, isAutoImported: data.isAutoImported ?? false } });
}

export async function getPendingChallengeMaps(options: { take?: number; after?: { createdAt: Date; id: string } | null } = {}) {
  const take = Math.min(Math.max(options.take ?? 5, 1), 25);
  const after = options.after ?? null;
  return prisma.challengeMap.findMany({ where: { status: "pending", isAutoImported: false, ...(after ? { OR: [{ createdAt: { gt: after.createdAt } }, { createdAt: after.createdAt, id: { gt: after.id } }] } : {}) }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take, include: { submittedBy: { select: { username: true, displayName: true, profileHandle: true, avatar: true } } } });
}

export async function reviewChallengeMap(mapId: string, reviewerId: string, status: "approved" | "rejected", _finalRating: number | null, note: string | null) {
  const map = await prisma.challengeMap.findUnique({ where: { id: mapId } });
  if (!map) throw new Error("Map not found.");
  if (map.status !== "pending") throw new Error("This map has already been reviewed.");
  const updated = await prisma.challengeMap.update({ where: { id: mapId }, data: { status, rating: null, reviewerNote: note?.trim() || null, reviewedById: reviewerId, reviewedAt: new Date() } });
  let analyzedRating: number | null = null;
  let analysisError: string | null = null;
  if (status === "approved") {
    try { analyzedRating = (await analyzeChallengeMap(mapId))?.rating ?? null; }
    catch (error) { analysisError = error instanceof Error ? error.message : "Automatic map analysis failed."; }
  }
  await prisma.notification.create({ data: { userId: map.submittedById, type: status === "approved" ? "map_approved" : "map_rejected", title: status === "approved" ? "Your map was approved" : "Your map was rejected", message: status === "approved" ? analyzedRating != null ? `"${map.title}" was approved with an analyzed difficulty rating of ${analyzedRating.toFixed(2)}.` : `"${map.title}" was approved, but its automatic difficulty analysis needs admin review.${analysisError ? ` ${analysisError}` : ""}` : `"${map.title}" was rejected.${note?.trim() ? `\n\nReason: ${note.trim()}` : ""}`, url: "/maps" } });
  return prisma.challengeMap.findUnique({ where: { id: updated.id } });
}

export type ChallengeMapCheckResult = { status: "no_profile" | "not_available" | "error" | "already" | "not_beat"; points: number } | { status: "out_of_range" | "failed"; points: number; rankInfo: RankInfo } | { status: "beat"; points: number; rankInfo: RankInfo; accuracy: number | null };

export async function checkAndAwardChallengeMap(userId: string, challengeMapId: string): Promise<ChallengeMapCheckResult> {
  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) return { status: "no_profile", points: 0 };
  return checkRankedMap(userId, challengeMapId) as Promise<ChallengeMapCheckResult>;
}

export async function checkAndAwardAllChallengeMaps(userId: string) { return checkAllRankedMaps(userId); }

export async function getChallengeMapsForRank(rankIndex: number) {
  await ensureMapAnalysisTable();
  const rank = RANKS[rankIndex] ?? RANKS[RANKS.length - 1];
  const ids = await prisma.$queryRawUnsafe<Array<{ mapId: string }>>(`SELECT "mapId" FROM "MapDifficultyAnalysis" WHERE status='analyzed' AND "analyzerVersion"=$1 AND "pointEligible"=TRUE AND rating >= $2 AND rating <= $3`, MAP_ANALYZER_VERSION, rank.rangeMin, rank.rangeMax);
  return prisma.challengeMap.findMany({ where: { id: { in: ids.map((row) => row.mapId) }, status: "approved", rating: { gte: rank.rangeMin, lte: rank.rangeMax } }, orderBy: [{ rating: "asc" }, { createdAt: "desc" }], include: { submittedBy: { select: { username: true, displayName: true, profileHandle: true, avatar: true } } } });
}

export { getApprovedMaps, getChallengeLeaderboard, getMapLeaderboard, getUserGlobalRank, resetUserRankedStatus } from "@/lib/maps-legacy";
