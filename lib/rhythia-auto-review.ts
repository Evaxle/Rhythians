import { prisma } from "@/lib/db";
import { ensureMapAnalysisTable } from "@/lib/map-analysis-store";
import { syncRhythiaMaps } from "@/lib/rhythia-map-sync";
import { recalculateUsersForMapAnalysis } from "@/lib/rhythia-mode-points";

type RhythiaMapStatus = "RANKED" | "UNRANKED" | "LEGACY";
type EligibilityRow = { mapId: string; pointEligible: boolean; sourceStatus: string };
const UNMATCHED_MARKER = "rhythia-auto-review-unmatched";

async function eligibilitySnapshot() {
  await ensureMapAnalysisTable();
  const rows = await prisma.$queryRawUnsafe<EligibilityRow[]>('SELECT "mapId","pointEligible","sourceStatus" FROM "MapDifficultyAnalysis"');
  return new Map(rows.map((row) => [row.mapId, `${row.sourceStatus}:${row.pointEligible ? 1 : 0}`]));
}

export async function syncAndAutoReviewRhythiaMaps(status?: RhythiaMapStatus) {
  const before = await eligibilitySnapshot();
  const result = await syncRhythiaMaps(status);
  const importer = await prisma.user.findFirst({ where: { profileHandle: "rhythia-imports" }, select: { id: true } });
  if (!importer) throw new Error("The rhythia-imports system user does not exist.");

  let unmatched = { count: 0 };
  if (!status) {
    unmatched = await prisma.challengeMap.updateMany({
      where: { isAutoImported: true, status: "pending" },
      data: { status: "rejected", reviewerNote: UNMATCHED_MARKER, reviewedById: importer.id, reviewedAt: new Date() },
    });
  }

  const after = await eligibilitySnapshot();
  const changedMapIds = [...after].filter(([mapId, value]) => before.get(mapId) !== value && before.has(mapId)).map(([mapId]) => mapId);
  let recalculatedUsers = 0;
  for (const mapId of changedMapIds) {
    const recalculated = await recalculateUsersForMapAnalysis(mapId);
    recalculatedUsers += recalculated.users;
  }

  return { ...result, autoRejected: unmatched.count, eligibilityChanges: changedMapIds.length, recalculatedUsers };
}
