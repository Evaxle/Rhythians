import { prisma } from "@/lib/db";
import { analyzeMapNotes, parseMapNotes, MAP_ANALYZER_VERSION, type MapDifficultyAnalysis, type MapPatternSegment, type MapSpeedProfile } from "@/lib/map-difficulty";
import { analyzeMapRankability, MAP_RANKABILITY_VERSION, MIN_POINT_RANKABILITY, type MapPatternProfile, type MapRankabilityAnalysis, type RankabilityIssue, type RankabilityMetric } from "@/lib/map-rankability";
import { resolveRhythiaMapSource } from "@/lib/rhythia-map-source";

export { MAP_ANALYZER_VERSION, MAP_RANKABILITY_VERSION, MIN_POINT_RANKABILITY };
export const UNRANKED_MAP_MARKER = "rhythia-unranked";

export type StoredMapAnalysis = {
  mapId: string;
  analyzerVersion: number;
  rankabilityVersion: number;
  status: string;
  sourceStatus: string;
  pointEligible: boolean;
  rating: number | null;
  directionScore: number | null;
  distanceScore: number | null;
  npsScore: number | null;
  staminaIndex: number | null;
  activeDurationMs: number | null;
  longestHardSectionMs: number | null;
  peakJumpNps: number | null;
  peakStreamNps: number | null;
  peakJumpStrain: number | null;
  peakStreamStrain: number | null;
  jumpRatio: number | null;
  rpl: number | null;
  rpv: number | null;
  rps: number | null;
  speedProfiles: MapSpeedProfile[];
  topSections: unknown[];
  patternSegments: MapPatternSegment[];
  rankabilityScore: number | null;
  rankabilityColor: string | null;
  rankabilityLabel: string | null;
  rankabilitySummary: string | null;
  rankabilityMetrics: RankabilityMetric[];
  rankabilityIssues: RankabilityIssue[];
  patternProfile: MapPatternProfile | null;
  error: string | null;
  analyzedAt: Date | null;
  updatedAt: Date;
};

type RawAnalysisRow = Omit<StoredMapAnalysis, "speedProfiles" | "topSections" | "patternSegments" | "rankabilityMetrics" | "rankabilityIssues" | "patternProfile"> & {
  speedProfiles: unknown;
  topSections: unknown;
  patternSegments: unknown;
  rankabilityMetrics: unknown;
  rankabilityIssues: unknown;
  patternProfile: unknown;
};
type RankedCandidate = { id: string };
type ClaimedCandidate = { id: string };

export async function ensureMapAnalysisTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MapDifficultyAnalysis" (
      "mapId" TEXT PRIMARY KEY REFERENCES "ChallengeMap"("id") ON DELETE CASCADE,
      "analyzerVersion" INTEGER NOT NULL DEFAULT 0,
      "rankabilityVersion" INTEGER NOT NULL DEFAULT 0,
      "status" TEXT NOT NULL DEFAULT 'unanalyzed',
      "sourceStatus" TEXT NOT NULL DEFAULT 'ranked',
      "pointEligible" BOOLEAN NOT NULL DEFAULT FALSE,
      "rating" DOUBLE PRECISION,
      "directionScore" DOUBLE PRECISION,
      "distanceScore" DOUBLE PRECISION,
      "npsScore" DOUBLE PRECISION,
      "staminaIndex" DOUBLE PRECISION,
      "activeDurationMs" INTEGER,
      "longestHardSectionMs" INTEGER,
      "peakJumpNps" DOUBLE PRECISION,
      "peakStreamNps" DOUBLE PRECISION,
      "peakJumpStrain" DOUBLE PRECISION,
      "peakStreamStrain" DOUBLE PRECISION,
      "jumpRatio" DOUBLE PRECISION,
      "rpl" INTEGER,
      "rpv" INTEGER,
      "rps" INTEGER,
      "speedProfiles" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "topSections" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "patternSegments" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "rankabilityScore" DOUBLE PRECISION,
      "rankabilityColor" TEXT,
      "rankabilityLabel" TEXT,
      "rankabilitySummary" TEXT,
      "rankabilityMetrics" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "rankabilityIssues" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "patternProfile" JSONB,
      "error" TEXT,
      "analyzedAt" TIMESTAMP(3),
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
  const alterations = [
    `ADD COLUMN IF NOT EXISTS "patternSegments" JSONB NOT NULL DEFAULT '[]'::jsonb`,
    `ADD COLUMN IF NOT EXISTS "rankabilityVersion" INTEGER NOT NULL DEFAULT 0`,
    `ADD COLUMN IF NOT EXISTS "rankabilityScore" DOUBLE PRECISION`,
    `ADD COLUMN IF NOT EXISTS "rankabilityColor" TEXT`,
    `ADD COLUMN IF NOT EXISTS "rankabilityLabel" TEXT`,
    `ADD COLUMN IF NOT EXISTS "rankabilitySummary" TEXT`,
    `ADD COLUMN IF NOT EXISTS "rankabilityMetrics" JSONB NOT NULL DEFAULT '[]'::jsonb`,
    `ADD COLUMN IF NOT EXISTS "rankabilityIssues" JSONB NOT NULL DEFAULT '[]'::jsonb`,
    `ADD COLUMN IF NOT EXISTS "patternProfile" JSONB`,
  ];
  for (const alteration of alterations) await prisma.$executeRawUnsafe(`ALTER TABLE "MapDifficultyAnalysis" ${alteration}`);
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "MapDifficultyAnalysis_status_idx" ON "MapDifficultyAnalysis"("status")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "MapDifficultyAnalysis_pointEligible_idx" ON "MapDifficultyAnalysis"("pointEligible")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "MapDifficultyAnalysis_rankability_idx" ON "MapDifficultyAnalysis"("rankabilityScore")');
}

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed as T[] : []; } catch { return []; }
  }
  return [];
}
function parseJsonObject<T>(value: unknown): T | null {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as T;
  if (typeof value === "string") {
    try { const parsed = JSON.parse(value); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as T : null; } catch { return null; }
  }
  return null;
}
function normalizeRow(row: RawAnalysisRow): StoredMapAnalysis {
  return {
    ...row,
    speedProfiles: parseJsonArray<MapSpeedProfile>(row.speedProfiles),
    topSections: parseJsonArray<unknown>(row.topSections),
    patternSegments: parseJsonArray<MapPatternSegment>(row.patternSegments),
    rankabilityMetrics: parseJsonArray<RankabilityMetric>(row.rankabilityMetrics),
    rankabilityIssues: parseJsonArray<RankabilityIssue>(row.rankabilityIssues),
    patternProfile: parseJsonObject<MapPatternProfile>(row.patternProfile),
  };
}

function sourceApiId(value: number) { return value < 0 ? value + 0x100000000 : value; }
function looksLikeMapPage(url: string) { return /^https?:\/\/(?:www\.)?rhythia\.com\/maps\/\d+\/?(?:[?#].*)?$/i.test(url); }
function sourcePointCapable(sourceStatus: string) { return sourceStatus === "ranked" || sourceStatus === "legacy"; }

export async function getMapAnalysis(mapId: string) {
  await ensureMapAnalysisTable();
  const rows = await prisma.$queryRawUnsafe<RawAnalysisRow[]>('SELECT * FROM "MapDifficultyAnalysis" WHERE "mapId"=$1 LIMIT 1', mapId);
  return rows[0] ? normalizeRow(rows[0]) : null;
}

export async function saveMapAnalysis(mapId: string, sourceStatus: string, analysis: MapDifficultyAnalysis, rankability: MapRankabilityAnalysis) {
  await ensureMapAnalysisTable();
  const defaultEligible = sourcePointCapable(sourceStatus) && rankability.pointSafe;
  await prisma.$executeRawUnsafe(`
    INSERT INTO "MapDifficultyAnalysis" (
      "mapId","analyzerVersion","rankabilityVersion","status","sourceStatus","pointEligible","rating","directionScore","distanceScore","npsScore","staminaIndex","activeDurationMs","longestHardSectionMs","peakJumpNps","peakStreamNps","peakJumpStrain","peakStreamStrain","jumpRatio","rpl","rpv","rps","speedProfiles","topSections","patternSegments","rankabilityScore","rankabilityColor","rankabilityLabel","rankabilitySummary","rankabilityMetrics","rankabilityIssues","patternProfile","error","analyzedAt","updatedAt"
    ) VALUES ($1,$2,$3,'analyzed',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::jsonb,$22::jsonb,$23::jsonb,$24,$25,$26,$27,$28::jsonb,$29::jsonb,$30::jsonb,NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    ON CONFLICT ("mapId") DO UPDATE SET
      "analyzerVersion"=EXCLUDED."analyzerVersion","rankabilityVersion"=EXCLUDED."rankabilityVersion","status"='analyzed',"sourceStatus"=EXCLUDED."sourceStatus","pointEligible"=EXCLUDED."pointEligible",
      "rating"=EXCLUDED."rating","directionScore"=EXCLUDED."directionScore","distanceScore"=EXCLUDED."distanceScore","npsScore"=EXCLUDED."npsScore","staminaIndex"=EXCLUDED."staminaIndex",
      "activeDurationMs"=EXCLUDED."activeDurationMs","longestHardSectionMs"=EXCLUDED."longestHardSectionMs","peakJumpNps"=EXCLUDED."peakJumpNps","peakStreamNps"=EXCLUDED."peakStreamNps",
      "peakJumpStrain"=EXCLUDED."peakJumpStrain","peakStreamStrain"=EXCLUDED."peakStreamStrain","jumpRatio"=EXCLUDED."jumpRatio","rpl"=EXCLUDED."rpl","rpv"=EXCLUDED."rpv","rps"=EXCLUDED."rps",
      "speedProfiles"=EXCLUDED."speedProfiles","topSections"=EXCLUDED."topSections","patternSegments"=EXCLUDED."patternSegments",
      "rankabilityScore"=EXCLUDED."rankabilityScore","rankabilityColor"=EXCLUDED."rankabilityColor","rankabilityLabel"=EXCLUDED."rankabilityLabel","rankabilitySummary"=EXCLUDED."rankabilitySummary",
      "rankabilityMetrics"=EXCLUDED."rankabilityMetrics","rankabilityIssues"=EXCLUDED."rankabilityIssues","patternProfile"=EXCLUDED."patternProfile",
      "error"=NULL,"analyzedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP`,
    mapId,
    analysis.version,
    rankability.version,
    sourceStatus,
    defaultEligible,
    analysis.rating,
    analysis.directionScore,
    analysis.distanceScore,
    analysis.npsScore,
    analysis.staminaIndex,
    analysis.activeDurationMs,
    analysis.longestHardSectionMs,
    analysis.peakJumpNps,
    analysis.peakStreamNps,
    analysis.peakJumpStrain,
    analysis.peakStreamStrain,
    analysis.jumpRatio,
    analysis.rewards.lock,
    analysis.rewards.vr,
    analysis.rewards.spin,
    JSON.stringify(analysis.speedProfiles),
    JSON.stringify(analysis.topSections),
    JSON.stringify(analysis.patternSegments),
    rankability.score,
    rankability.color,
    rankability.label,
    rankability.summary,
    JSON.stringify(rankability.metrics),
    JSON.stringify(rankability.issues),
    JSON.stringify(rankability.patterns),
  );
  await prisma.challengeMap.update({ where: { id: mapId }, data: { rating: analysis.rating, requestedRating: analysis.rating, noteCount: analysis.noteCount } });
  return getMapAnalysis(mapId);
}

export async function markMapAnalysisFailed(mapId: string, sourceStatus: string, error: string) {
  await ensureMapAnalysisTable();
  await prisma.$executeRawUnsafe(`
    INSERT INTO "MapDifficultyAnalysis" ("mapId","analyzerVersion","rankabilityVersion","status","sourceStatus","pointEligible","error","updatedAt")
    VALUES ($1,$2,$3,'failed',$4,FALSE,$5,CURRENT_TIMESTAMP)
    ON CONFLICT ("mapId") DO UPDATE SET
      "analyzerVersion"=EXCLUDED."analyzerVersion","rankabilityVersion"=EXCLUDED."rankabilityVersion","status"='failed',"sourceStatus"=EXCLUDED."sourceStatus","pointEligible"=FALSE,
      "rating"=NULL,"directionScore"=NULL,"distanceScore"=NULL,"npsScore"=NULL,"staminaIndex"=NULL,"activeDurationMs"=NULL,"longestHardSectionMs"=NULL,
      "peakJumpNps"=NULL,"peakStreamNps"=NULL,"peakJumpStrain"=NULL,"peakStreamStrain"=NULL,"jumpRatio"=NULL,"rpl"=NULL,"rpv"=NULL,"rps"=NULL,
      "speedProfiles"='[]'::jsonb,"topSections"='[]'::jsonb,"patternSegments"='[]'::jsonb,
      "rankabilityScore"=NULL,"rankabilityColor"=NULL,"rankabilityLabel"=NULL,"rankabilitySummary"=NULL,"rankabilityMetrics"='[]'::jsonb,"rankabilityIssues"='[]'::jsonb,"patternProfile"=NULL,
      "error"=EXCLUDED."error","analyzedAt"=NULL,"updatedAt"=CURRENT_TIMESTAMP`,
    mapId, MAP_ANALYZER_VERSION, MAP_RANKABILITY_VERSION, sourceStatus, error.slice(0, 1000),
  );
  await prisma.challengeMap.update({ where: { id: mapId }, data: { rating: null, requestedRating: 0 } }).catch(() => null);
}

export async function setMapPointEligibility(mapId: string, pointEligible: boolean) {
  await ensureMapAnalysisTable();
  const analysis = await getMapAnalysis(mapId);
  if (!analysis || !analysisIsCurrent(analysis)) throw new Error("Analyze this map with the current difficulty and rankability analyzers before changing point eligibility.");
  if (pointEligible && !sourcePointCapable(analysis.sourceStatus)) throw new Error("Only Ranked and Legacy Rhythia maps can award RPL, RPV, RPS, or RHP.");
  if (pointEligible && (analysis.rankabilityScore ?? 0) < MIN_POINT_RANKABILITY) throw new Error(`This map has ${analysis.rankabilityScore?.toFixed(2) ?? "no"}/5 rankability. Point maps require at least ${MIN_POINT_RANKABILITY.toFixed(2)}/5.`);
  await prisma.$executeRawUnsafe('UPDATE "MapDifficultyAnalysis" SET "pointEligible"=$2,"updatedAt"=CURRENT_TIMESTAMP WHERE "mapId"=$1', mapId, pointEligible);
  return getMapAnalysis(mapId);
}

async function downloadMap(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { cache: "no-store", redirect: "follow", signal: controller.signal, headers: { accept: "application/octet-stream,application/zip,application/json;q=0.9,*/*;q=0.1", "user-agent": `Rhythians-MapAnalyzer/${MAP_ANALYZER_VERSION}.0` } });
    if (!response.ok) throw new Error(`Map download returned HTTP ${response.status}.`);
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (contentType.includes("text/html")) throw new Error("Map source returned an HTML page instead of the map file.");
    const length = Number(response.headers.get("content-length") ?? 0);
    if (Number.isFinite(length) && length > 64 * 1024 * 1024) throw new Error("Map file is too large to analyze safely.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0) throw new Error("Map source returned an empty file.");
    if (bytes.byteLength > 64 * 1024 * 1024) throw new Error("Map file is too large to analyze safely.");
    const prefix = new TextDecoder().decode(bytes.slice(0, Math.min(128, bytes.length))).trimStart().toLowerCase();
    if (prefix.startsWith("<!doctype html") || prefix.startsWith("<html")) throw new Error("Map source returned an HTML page instead of the map file.");
    return bytes;
  } finally { clearTimeout(timeout); }
}

async function resolveMapAssets(map: { id: string; mapFileUrl: string; imageUrl: string | null; mapperName: string | null; noteCount: number | null; length: number | null; sourceBeatmapId: number | null }) {
  if (map.sourceBeatmapId == null) return map;
  let resolved: Awaited<ReturnType<typeof resolveRhythiaMapSource>> | null = null;
  try { resolved = await resolveRhythiaMapSource(sourceApiId(map.sourceBeatmapId)); } catch {}
  if (!resolved) return map;
  const mapFileUrl = resolved.mapFileUrl ?? map.mapFileUrl;
  const imageUrl = resolved.imageUrl ?? map.imageUrl;
  const mapperName = resolved.mapperName ?? map.mapperName;
  const noteCount = resolved.noteCount ?? map.noteCount;
  const length = resolved.length ?? map.length;
  if (mapFileUrl !== map.mapFileUrl || imageUrl !== map.imageUrl || mapperName !== map.mapperName || noteCount !== map.noteCount || length !== map.length) await prisma.challengeMap.update({ where: { id: map.id }, data: { mapFileUrl, imageUrl, mapperName, noteCount, length } });
  return { ...map, mapFileUrl, imageUrl, mapperName, noteCount, length };
}

export async function analyzeChallengeMap(mapId: string) {
  const map = await prisma.challengeMap.findUnique({ where: { id: mapId }, select: { id: true, mapFileUrl: true, imageUrl: true, mapperName: true, noteCount: true, length: true, sourceBeatmapId: true, reviewerNote: true, status: true } });
  if (!map) throw new Error("Map not found.");
  const sourceStatus = map.reviewerNote === UNRANKED_MAP_MARKER ? "unranked" : map.status === "legacy" ? "legacy" : "ranked";
  try {
    const resolved = await resolveMapAssets(map);
    if (looksLikeMapPage(resolved.mapFileUrl)) throw new Error("Rhythia did not expose a downloadable SSPM/RHM map file for this map.");
    const bytes = await downloadMap(resolved.mapFileUrl);
    const notes = parseMapNotes(bytes);
    const analysis = analyzeMapNotes(notes);
    const rankability = analyzeMapRankability(notes, analysis.topSections);
    return await saveMapAnalysis(map.id, sourceStatus, analysis, rankability);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Map analysis failed.";
    await markMapAnalysisFailed(map.id, sourceStatus, message);
    throw new Error(message);
  }
}

async function rankedAnalysisQueue(limit: number) {
  await ensureMapAnalysisTable();
  return prisma.$queryRawUnsafe<RankedCandidate[]>(`
    SELECT c.id FROM "ChallengeMap" c
    LEFT JOIN "MapDifficultyAnalysis" a ON a."mapId"=c.id
    WHERE c.status='approved' AND c."reviewerNote" IS DISTINCT FROM $1
      AND (a."mapId" IS NULL OR a."analyzerVersion" <> $2 OR a."rankabilityVersion" <> $3 OR a.status IN ('unanalyzed','failed'))
    ORDER BY c."updatedAt" ASC,c.id ASC LIMIT $4`,
    UNRANKED_MAP_MARKER, MAP_ANALYZER_VERSION, MAP_RANKABILITY_VERSION, Math.max(1, Math.min(20, limit)),
  );
}

export async function getRankedAnalysisStats() {
  await ensureMapAnalysisTable();
  const rows = await prisma.$queryRawUnsafe<Array<{ total: bigint; analyzed: bigint; failed: bigint; pending: bigint; rankable: bigint }>>(`
    SELECT COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE a.status='analyzed' AND a."analyzerVersion"=$2 AND a."rankabilityVersion"=$3)::bigint AS analyzed,
      COUNT(*) FILTER (WHERE a.status='failed' AND a."analyzerVersion"=$2 AND a."rankabilityVersion"=$3)::bigint AS failed,
      COUNT(*) FILTER (WHERE a."mapId" IS NULL OR a."analyzerVersion" <> $2 OR a."rankabilityVersion" <> $3 OR a.status IN ('unanalyzed','failed'))::bigint AS pending,
      COUNT(*) FILTER (WHERE a.status='analyzed' AND a."rankabilityScore">=$4)::bigint AS rankable
    FROM "ChallengeMap" c LEFT JOIN "MapDifficultyAnalysis" a ON a."mapId"=c.id
    WHERE c.status='approved' AND c."reviewerNote" IS DISTINCT FROM $1`,
    UNRANKED_MAP_MARKER, MAP_ANALYZER_VERSION, MAP_RANKABILITY_VERSION, MIN_POINT_RANKABILITY,
  );
  const row = rows[0] ?? { total: 0n, analyzed: 0n, failed: 0n, pending: 0n, rankable: 0n };
  return { total: Number(row.total), analyzed: Number(row.analyzed), failed: Number(row.failed), pending: Number(row.pending), rankable: Number(row.rankable) };
}

export async function analyzePendingRankedMaps(limit = 3) {
  const queue = await rankedAnalysisQueue(limit);
  let succeeded = 0;
  let failed = 0;
  const succeededMapIds: string[] = [];
  const failedMapIds: string[] = [];
  const errors: Array<{ mapId: string; error: string }> = [];
  for (const map of queue) {
    try { await analyzeChallengeMap(map.id); succeeded += 1; succeededMapIds.push(map.id); }
    catch (error) { failed += 1; failedMapIds.push(map.id); errors.push({ mapId: map.id, error: error instanceof Error ? error.message : "Analysis failed." }); }
  }
  return { processed: queue.length, succeeded, failed, succeededMapIds, failedMapIds, errors: errors.slice(0, 5), stats: await getRankedAnalysisStats() };
}

export async function claimPendingMapAnalysisIds(limit = 5) {
  await ensureMapAnalysisTable();
  const safeLimit = Math.max(1, Math.min(5, Math.floor(limit)));
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe<ClaimedCandidate[]>(`
      SELECT c.id FROM "ChallengeMap" c
      LEFT JOIN "MapDifficultyAnalysis" a ON a."mapId"=c.id
      WHERE c.status IN ('approved','legacy')
        AND (
          a."mapId" IS NULL OR a."analyzerVersion" <> $1 OR a."rankabilityVersion" <> $2 OR a.status='unanalyzed'
          OR (a.status='failed' AND a."updatedAt" < CURRENT_TIMESTAMP - INTERVAL '24 hours')
          OR (a.status='analyzing' AND a."updatedAt" < CURRENT_TIMESTAMP - INTERVAL '10 minutes')
        )
      ORDER BY CASE WHEN c.status='approved' AND c."reviewerNote" IS DISTINCT FROM $3 THEN 0 WHEN c.status='legacy' THEN 1 ELSE 2 END,
        COALESCE(a."analyzedAt",TIMESTAMP '1970-01-01') ASC,c."updatedAt" ASC,c.id ASC
      FOR UPDATE OF c SKIP LOCKED LIMIT $4`, MAP_ANALYZER_VERSION, MAP_RANKABILITY_VERSION, UNRANKED_MAP_MARKER, safeLimit);
    for (const row of rows) {
      const map = await tx.challengeMap.findUnique({ where: { id: row.id }, select: { status: true, reviewerNote: true } });
      const sourceStatus = map?.reviewerNote === UNRANKED_MAP_MARKER ? "unranked" : map?.status === "legacy" ? "legacy" : "ranked";
      await tx.$executeRawUnsafe(`INSERT INTO "MapDifficultyAnalysis" ("mapId","analyzerVersion","rankabilityVersion","status","sourceStatus","pointEligible","updatedAt") VALUES ($1,$2,$3,'analyzing',$4,FALSE,CURRENT_TIMESTAMP) ON CONFLICT ("mapId") DO UPDATE SET "status"='analyzing',"sourceStatus"=EXCLUDED."sourceStatus","updatedAt"=CURRENT_TIMESTAMP`, row.id, MAP_ANALYZER_VERSION, MAP_RANKABILITY_VERSION, sourceStatus);
    }
    return rows.map((row) => row.id);
  });
}

export async function getAllAnalysisStats() {
  await ensureMapAnalysisTable();
  const rows = await prisma.$queryRawUnsafe<Array<{ total: bigint; analyzed: bigint; failed: bigint; pending: bigint; green: bigint; yellow: bigint; orange: bigint; red: bigint }>>(`
    SELECT COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE a.status='analyzed' AND a."analyzerVersion"=$1 AND a."rankabilityVersion"=$2)::bigint AS analyzed,
      COUNT(*) FILTER (WHERE a.status='failed' AND a."analyzerVersion"=$1 AND a."rankabilityVersion"=$2)::bigint AS failed,
      COUNT(*) FILTER (WHERE a."mapId" IS NULL OR a."analyzerVersion"<>$1 OR a."rankabilityVersion"<>$2 OR a.status NOT IN ('analyzed','failed'))::bigint AS pending,
      COUNT(*) FILTER (WHERE a."rankabilityScore">=4)::bigint AS green,
      COUNT(*) FILTER (WHERE a."rankabilityScore">=3 AND a."rankabilityScore"<4)::bigint AS yellow,
      COUNT(*) FILTER (WHERE a."rankabilityScore">=2 AND a."rankabilityScore"<3)::bigint AS orange,
      COUNT(*) FILTER (WHERE a."rankabilityScore">=1 AND a."rankabilityScore"<2)::bigint AS red
    FROM "ChallengeMap" c LEFT JOIN "MapDifficultyAnalysis" a ON a."mapId"=c.id WHERE c.status IN ('approved','legacy')`, MAP_ANALYZER_VERSION, MAP_RANKABILITY_VERSION);
  const row = rows[0] ?? { total: 0n, analyzed: 0n, failed: 0n, pending: 0n, green: 0n, yellow: 0n, orange: 0n, red: 0n };
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)])) as { total: number; analyzed: number; failed: number; pending: number; green: number; yellow: number; orange: number; red: number };
}

export function analysisIsCurrent(analysis: Pick<StoredMapAnalysis, "status" | "analyzerVersion" | "rankabilityVersion"> | null | undefined) {
  return Boolean(analysis && analysis.status === "analyzed" && analysis.analyzerVersion === MAP_ANALYZER_VERSION && analysis.rankabilityVersion === MAP_RANKABILITY_VERSION);
}

export function analysisCanAwardPoints(analysis: Pick<StoredMapAnalysis, "status" | "analyzerVersion" | "rankabilityVersion" | "pointEligible" | "sourceStatus" | "rankabilityScore"> | null | undefined) {
  return Boolean(analysisIsCurrent(analysis) && analysis?.pointEligible && sourcePointCapable(analysis.sourceStatus) && (analysis.rankabilityScore ?? 0) >= MIN_POINT_RANKABILITY);
}
