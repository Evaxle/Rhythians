import { prisma } from "@/lib/db";
import { analyzeChallengeMap, ensureMapAnalysisTable, MAP_ANALYZER_VERSION } from "@/lib/map-analysis-store";

type Candidate = { id: string };

async function pendingMaps(limit: number) {
  await ensureMapAnalysisTable();
  return prisma.$queryRawUnsafe<Candidate[]>(`
    SELECT c.id
    FROM "ChallengeMap" c
    LEFT JOIN "MapDifficultyAnalysis" a ON a."mapId"=c.id
    WHERE c.status IN ('approved','legacy')
      AND (a."mapId" IS NULL OR a."analyzerVersion" <> $1 OR a.status='unanalyzed')
    ORDER BY c."updatedAt" ASC,c.id ASC
    LIMIT $2`,
    MAP_ANALYZER_VERSION,
    Math.max(1, Math.min(10, limit)),
  );
}

export async function getAllMapAnalysisStats() {
  await ensureMapAnalysisTable();
  const rows = await prisma.$queryRawUnsafe<Array<{ total: bigint; analyzed: bigint; failed: bigint; pending: bigint }>>(`
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE a.status='analyzed' AND a."analyzerVersion"=$1)::bigint AS analyzed,
      COUNT(*) FILTER (WHERE a.status='failed' AND a."analyzerVersion"=$1)::bigint AS failed,
      COUNT(*) FILTER (WHERE a."mapId" IS NULL OR a."analyzerVersion" <> $1 OR a.status='unanalyzed')::bigint AS pending
    FROM "ChallengeMap" c
    LEFT JOIN "MapDifficultyAnalysis" a ON a."mapId"=c.id
    WHERE c.status IN ('approved','legacy')`,
    MAP_ANALYZER_VERSION,
  );
  const row = rows[0] ?? { total: 0n, analyzed: 0n, failed: 0n, pending: 0n };
  return { total: Number(row.total), analyzed: Number(row.analyzed), failed: Number(row.failed), pending: Number(row.pending), analyzerVersion: MAP_ANALYZER_VERSION };
}

export async function analyzePendingMaps(limit = 2) {
  const queue = await pendingMaps(limit);
  let succeeded = 0;
  let failed = 0;
  const succeededMapIds: string[] = [];
  const failedMapIds: string[] = [];
  const errors: Array<{ mapId: string; error: string }> = [];
  for (const map of queue) {
    try {
      await analyzeChallengeMap(map.id);
      succeeded += 1;
      succeededMapIds.push(map.id);
    } catch (error) {
      failed += 1;
      failedMapIds.push(map.id);
      errors.push({ mapId: map.id, error: error instanceof Error ? error.message : "Analysis failed." });
    }
  }
  return { processed: queue.length, succeeded, failed, succeededMapIds, failedMapIds, errors: errors.slice(0, 5), stats: await getAllMapAnalysisStats() };
}
