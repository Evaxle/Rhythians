import { prisma } from "@/lib/db";
import { analyzeMapBytes, MAP_ANALYZER_VERSION, type MapDifficultyAnalysis, type MapSpeedProfile } from "@/lib/map-difficulty";

export { MAP_ANALYZER_VERSION };
export const UNRANKED_MAP_MARKER = "rhythia-unranked";

export type StoredMapAnalysis = {
  mapId: string;
  analyzerVersion: number;
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
  error: string | null;
  analyzedAt: Date | null;
  updatedAt: Date;
};

type RawAnalysisRow = Omit<StoredMapAnalysis, "speedProfiles" | "topSections"> & { speedProfiles: unknown; topSections: unknown };

export async function ensureMapAnalysisTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MapDifficultyAnalysis" (
      "mapId" TEXT PRIMARY KEY REFERENCES "ChallengeMap"("id") ON DELETE CASCADE,
      "analyzerVersion" INTEGER NOT NULL DEFAULT 0,
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
      "error" TEXT,
      "analyzedAt" TIMESTAMP(3),
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "MapDifficultyAnalysis_status_idx" ON "MapDifficultyAnalysis"("status")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "MapDifficultyAnalysis_pointEligible_idx" ON "MapDifficultyAnalysis"("pointEligible")');
}

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed as T[] : []; } catch { return []; }
  }
  return [];
}
function normalizeRow(row: RawAnalysisRow): StoredMapAnalysis {
  return { ...row, speedProfiles: parseJsonArray<MapSpeedProfile>(row.speedProfiles), topSections: parseJsonArray<unknown>(row.topSections) };
}

export async function getMapAnalysis(mapId: string) {
  await ensureMapAnalysisTable();
  const rows = await prisma.$queryRawUnsafe<RawAnalysisRow[]>('SELECT * FROM "MapDifficultyAnalysis" WHERE "mapId"=$1 LIMIT 1', mapId);
  return rows[0] ? normalizeRow(rows[0]) : null;
}

export async function saveMapAnalysis(mapId: string, sourceStatus: string, analysis: MapDifficultyAnalysis) {
  await ensureMapAnalysisTable();
  const previous = await getMapAnalysis(mapId);
  const eligible = sourceStatus === "ranked" ? true : previous?.pointEligible ?? false;
  await prisma.$executeRawUnsafe(`
    INSERT INTO "MapDifficultyAnalysis" (
      "mapId","analyzerVersion","status","sourceStatus","pointEligible","rating","directionScore","distanceScore","npsScore","staminaIndex","activeDurationMs","longestHardSectionMs","peakJumpNps","peakStreamNps","peakJumpStrain","peakStreamStrain","jumpRatio","rpl","rpv","rps","speedProfiles","topSections","error","analyzedAt","updatedAt"
    ) VALUES ($1,$2,'analyzed',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb,$21::jsonb,NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    ON CONFLICT ("mapId") DO UPDATE SET
      "analyzerVersion"=EXCLUDED."analyzerVersion","status"='analyzed',"sourceStatus"=EXCLUDED."sourceStatus","pointEligible"=EXCLUDED."pointEligible","rating"=EXCLUDED."rating","directionScore"=EXCLUDED."directionScore","distanceScore"=EXCLUDED."distanceScore","npsScore"=EXCLUDED."npsScore","staminaIndex"=EXCLUDED."staminaIndex","activeDurationMs"=EXCLUDED."activeDurationMs","longestHardSectionMs"=EXCLUDED."longestHardSectionMs","peakJumpNps"=EXCLUDED."peakJumpNps","peakStreamNps"=EXCLUDED."peakStreamNps","peakJumpStrain"=EXCLUDED."peakJumpStrain","peakStreamStrain"=EXCLUDED."peakStreamStrain","jumpRatio"=EXCLUDED."jumpRatio","rpl"=EXCLUDED."rpl","rpv"=EXCLUDED."rpv","rps"=EXCLUDED."rps","speedProfiles"=EXCLUDED."speedProfiles","topSections"=EXCLUDED."topSections","error"=NULL,"analyzedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP`,
    mapId, analysis.version, sourceStatus, eligible, analysis.rating, analysis.directionScore, analysis.distanceScore, analysis.npsScore, analysis.staminaIndex, analysis.activeDurationMs, analysis.longestHardSectionMs, analysis.peakJumpNps, analysis.peakStreamNps, analysis.peakJumpStrain, analysis.peakStreamStrain, analysis.jumpRatio, analysis.rewards.lock, analysis.rewards.vr, analysis.rewards.spin, JSON.stringify(analysis.speedProfiles), JSON.stringify(analysis.topSections));
  await prisma.challengeMap.update({ where: { id: mapId }, data: { rating: analysis.rating, requestedRating: analysis.rating, noteCount: analysis.noteCount } });
  return getMapAnalysis(mapId);
}

export async function markMapAnalysisFailed(mapId: string, sourceStatus: string, error: string) {
  await ensureMapAnalysisTable();
  await prisma.$executeRawUnsafe(`INSERT INTO "MapDifficultyAnalysis" ("mapId","analyzerVersion","status","sourceStatus","pointEligible","error","updatedAt") VALUES ($1,$2,'failed',$3,FALSE,$4,CURRENT_TIMESTAMP) ON CONFLICT ("mapId") DO UPDATE SET "analyzerVersion"=EXCLUDED."analyzerVersion","status"='failed',"sourceStatus"=EXCLUDED."sourceStatus","error"=EXCLUDED."error","updatedAt"=CURRENT_TIMESTAMP`, mapId, MAP_ANALYZER_VERSION, sourceStatus, error.slice(0, 1000));
}

export async function setMapPointEligibility(mapId: string, pointEligible: boolean) {
  await ensureMapAnalysisTable();
  const analysis = await getMapAnalysis(mapId);
  if (!analysis || analysis.status !== "analyzed" || analysis.analyzerVersion !== MAP_ANALYZER_VERSION) throw new Error("Analyze this map with the current analyzer before changing rank-point eligibility.");
  await prisma.$executeRawUnsafe('UPDATE "MapDifficultyAnalysis" SET "pointEligible"=$2,"updatedAt"=CURRENT_TIMESTAMP WHERE "mapId"=$1', mapId, pointEligible);
  return getMapAnalysis(mapId);
}

async function downloadMap(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal, headers: { accept: "application/octet-stream,application/zip,application/json;q=0.9,*/*;q=0.1", "user-agent": "Rhythians-MapAnalyzer/1.0" } });
    if (!response.ok) throw new Error(`Map download returned HTTP ${response.status}.`);
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (contentType.includes("text/html")) throw new Error("Map source returned an HTML page instead of the map file.");
    const length = Number(response.headers.get("content-length") ?? 0);
    if (Number.isFinite(length) && length > 64 * 1024 * 1024) throw new Error("Map file is too large to analyze safely.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > 64 * 1024 * 1024) throw new Error("Map file is too large to analyze safely.");
    return bytes;
  } finally { clearTimeout(timeout); }
}

export async function analyzeChallengeMap(mapId: string) {
  const map = await prisma.challengeMap.findUnique({ where: { id: mapId }, select: { id: true, mapFileUrl: true, reviewerNote: true, status: true } });
  if (!map) throw new Error("Map not found.");
  const sourceStatus = map.reviewerNote === UNRANKED_MAP_MARKER ? "unranked" : map.status === "legacy" ? "legacy" : "ranked";
  try {
    const bytes = await downloadMap(map.mapFileUrl);
    const analysis = analyzeMapBytes(bytes);
    return await saveMapAnalysis(map.id, sourceStatus, analysis);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Map analysis failed.";
    await markMapAnalysisFailed(map.id, sourceStatus, message);
    throw new Error(message);
  }
}

export function analysisIsCurrent(analysis: Pick<StoredMapAnalysis, "status" | "analyzerVersion"> | null | undefined) { return Boolean(analysis && analysis.status === "analyzed" && analysis.analyzerVersion === MAP_ANALYZER_VERSION); }
