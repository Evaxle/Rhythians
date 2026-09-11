import { prisma } from "@/lib/db";
import {
  analyzeChallengeMap,
  ensureMapAnalysisTable,
  MAP_ANALYZER_VERSION,
  UNRANKED_MAP_MARKER,
} from "@/lib/map-analysis-store";

export type AnalysisSource = "all" | "ranked" | "unranked" | "legacy";
type Candidate = { id: string };

function sourceClause() {
  return `(
    $2 = 'all'
    OR ($2 = 'ranked' AND c.status='approved' AND COALESCE(c."reviewerNote", '') <> $3)
    OR ($2 = 'unranked' AND c.status='approved' AND c."reviewerNote" = $3)
    OR ($2 = 'legacy' AND c.status='legacy')
  )`;
}

function pendingClause() {
  return `(
    a."mapId" IS NULL
    OR a."analyzerVersion" <> $1
    OR a.status='unanalyzed'
    OR (a.status='failed' AND a."updatedAt" < CURRENT_TIMESTAMP - INTERVAL '6 hours')
  )`;
}

async function pendingMaps(limit: number, source: AnalysisSource) {
  await ensureMapAnalysisTable();
  return prisma.$queryRawUnsafe<Candidate[]>(`
    SELECT c.id
    FROM "ChallengeMap" c
    LEFT JOIN "MapDifficultyAnalysis" a ON a."mapId"=c.id
    WHERE ${sourceClause()}
      AND ${pendingClause()}
    ORDER BY
      CASE WHEN a."mapId" IS NULL THEN 0 WHEN a."analyzerVersion" <> $1 THEN 1 WHEN a.status='unanalyzed' THEN 2 ELSE 3 END,
      c."updatedAt" ASC,
      c.id ASC
    LIMIT $4`,
    MAP_ANALYZER_VERSION,
    source,
    UNRANKED_MAP_MARKER,
    Math.max(1, Math.min(10, limit)),
  );
}

async function forcedMaps(limit: number, source: AnalysisSource, cursor: string | null) {
  await ensureMapAnalysisTable();
  return prisma.$queryRawUnsafe<Candidate[]>(`
    SELECT c.id
    FROM "ChallengeMap" c
    WHERE (
      $1 = 'all'
      OR ($1 = 'ranked' AND c.status='approved' AND COALESCE(c."reviewerNote", '') <> $2)
      OR ($1 = 'unranked' AND c.status='approved' AND c."reviewerNote" = $2)
      OR ($1 = 'legacy' AND c.status='legacy')
    )
      AND ($3::text IS NULL OR c.id > $3)
    ORDER BY c.id ASC
    LIMIT $4`,
    source,
    UNRANKED_MAP_MARKER,
    cursor,
    Math.max(1, Math.min(10, limit)),
  );
}

export async function getAllMapAnalysisStats(source: AnalysisSource = "all") {
  await ensureMapAnalysisTable();
  const rows = await prisma.$queryRawUnsafe<
    Array<{ total: bigint; analyzed: bigint; failed: bigint; pending: bigint }>
  >(`
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE a.status='analyzed' AND a."analyzerVersion"=$1)::bigint AS analyzed,
      COUNT(*) FILTER (WHERE a.status='failed' AND a."analyzerVersion"=$1)::bigint AS failed,
      COUNT(*) FILTER (WHERE ${pendingClause()})::bigint AS pending
    FROM "ChallengeMap" c
    LEFT JOIN "MapDifficultyAnalysis" a ON a."mapId"=c.id
    WHERE ${sourceClause()}`,
    MAP_ANALYZER_VERSION,
    source,
    UNRANKED_MAP_MARKER,
  );

  const row = rows[0] ?? { total: 0n, analyzed: 0n, failed: 0n, pending: 0n };
  return {
    total: Number(row.total),
    analyzed: Number(row.analyzed),
    failed: Number(row.failed),
    pending: Number(row.pending),
    analyzerVersion: MAP_ANALYZER_VERSION,
    source,
  };
}

export async function analyzeMaps(
  limit = 2,
  source: AnalysisSource = "all",
  options?: { force?: boolean; cursor?: string | null },
) {
  const force = Boolean(options?.force);
  const cursor = options?.cursor ?? null;
  const safeLimit = Math.max(1, Math.min(10, limit));
  const queue = force
    ? await forcedMaps(safeLimit, source, cursor)
    : await pendingMaps(safeLimit, source);

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
      errors.push({
        mapId: map.id,
        error: error instanceof Error ? error.message : "Analysis failed.",
      });
    }
  }

  const nextCursor = force && queue.length ? queue[queue.length - 1].id : null;
  return {
    processed: queue.length,
    succeeded,
    failed,
    succeededMapIds,
    failedMapIds,
    errors: errors.slice(0, 8),
    stats: await getAllMapAnalysisStats(source),
    source,
    force,
    nextCursor,
    done: force ? queue.length < safeLimit : queue.length === 0,
  };
}

export async function analyzePendingMaps(limit = 2, source: AnalysisSource = "all") {
  return analyzeMaps(limit, source);
}
