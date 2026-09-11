import { prisma } from "@/lib/db";
import {
  analyzeMapBytes,
  MAP_ANALYZER_VERSION,
  type MapDifficultyAnalysis,
  type MapDifficultyDetails,
  type MapPatternSegment,
  type MapSpeedProfile,
} from "@/lib/map-difficulty";
import { resolveRhythiaMapSource } from "@/lib/rhythia-map-source";

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
  patternSegments: MapPatternSegment[];
  analysisDetails: MapDifficultyDetails | null;
  error: string | null;
  analyzedAt: Date | null;
  updatedAt: Date;
};

type RawAnalysisRow = Omit<
  StoredMapAnalysis,
  "speedProfiles" | "topSections" | "patternSegments" | "analysisDetails"
> & {
  speedProfiles: unknown;
  topSections: unknown;
  patternSegments: unknown;
  analysisDetails: unknown;
};

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
      "patternSegments" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "analysisDetails" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "error" TEXT,
      "analyzedAt" TIMESTAMP(3),
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "MapDifficultyAnalysis" ADD COLUMN IF NOT EXISTS "patternSegments" JSONB NOT NULL DEFAULT '[]'::jsonb`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "MapDifficultyAnalysis" ADD COLUMN IF NOT EXISTS "analysisDetails" JSONB NOT NULL DEFAULT '{}'::jsonb`,
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "MapDifficultyAnalysis_status_idx" ON "MapDifficultyAnalysis"("status")',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "MapDifficultyAnalysis_pointEligible_idx" ON "MapDifficultyAnalysis"("pointEligible")',
  );
}

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed as T[] : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseJsonObject<T extends object>(value: unknown): T | null {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as T;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as T : null;
    } catch {
      return null;
    }
  }
  return null;
}

function normalizeRow(row: RawAnalysisRow): StoredMapAnalysis {
  return {
    ...row,
    speedProfiles: parseJsonArray<MapSpeedProfile>(row.speedProfiles),
    topSections: parseJsonArray<unknown>(row.topSections),
    patternSegments: parseJsonArray<MapPatternSegment>(row.patternSegments),
    analysisDetails: parseJsonObject<MapDifficultyDetails>(row.analysisDetails),
  };
}

function sourceApiId(value: number) {
  return value < 0 ? value + 0x100000000 : value;
}

function looksLikeMapPage(url: string) {
  return /^https?:\/\/(?:www\.)?rhythia\.com\/maps\/\d+\/?(?:[?#].*)?$/i.test(url);
}

export async function getMapAnalysis(mapId: string) {
  await ensureMapAnalysisTable();
  const rows = await prisma.$queryRawUnsafe<RawAnalysisRow[]>(
    'SELECT * FROM "MapDifficultyAnalysis" WHERE "mapId"=$1 LIMIT 1',
    mapId,
  );
  return rows[0] ? normalizeRow(rows[0]) : null;
}

export function analysisIsCurrent(
  analysis: Pick<StoredMapAnalysis, "status" | "analyzerVersion"> | null | undefined,
) {
  return Boolean(
    analysis &&
    analysis.status === "analyzed" &&
    analysis.analyzerVersion === MAP_ANALYZER_VERSION,
  );
}

export async function saveMapAnalysis(
  mapId: string,
  sourceStatus: string,
  analysis: MapDifficultyAnalysis,
) {
  await ensureMapAnalysisTable();
  const eligible = sourceStatus === "ranked";

  await prisma.$executeRawUnsafe(
    `
    INSERT INTO "MapDifficultyAnalysis" (
      "mapId","analyzerVersion","status","sourceStatus","pointEligible","rating",
      "directionScore","distanceScore","npsScore","staminaIndex","activeDurationMs",
      "longestHardSectionMs","peakJumpNps","peakStreamNps","peakJumpStrain",
      "peakStreamStrain","jumpRatio","rpl","rpv","rps","speedProfiles","topSections",
      "patternSegments","analysisDetails","error","analyzedAt","updatedAt"
    ) VALUES (
      $1,$2,'analyzed',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
      $20::jsonb,$21::jsonb,$22::jsonb,$23::jsonb,NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
    )
    ON CONFLICT ("mapId") DO UPDATE SET
      "analyzerVersion"=EXCLUDED."analyzerVersion",
      "status"='analyzed',
      "sourceStatus"=EXCLUDED."sourceStatus",
      "pointEligible"=EXCLUDED."pointEligible",
      "rating"=EXCLUDED."rating",
      "directionScore"=EXCLUDED."directionScore",
      "distanceScore"=EXCLUDED."distanceScore",
      "npsScore"=EXCLUDED."npsScore",
      "staminaIndex"=EXCLUDED."staminaIndex",
      "activeDurationMs"=EXCLUDED."activeDurationMs",
      "longestHardSectionMs"=EXCLUDED."longestHardSectionMs",
      "peakJumpNps"=EXCLUDED."peakJumpNps",
      "peakStreamNps"=EXCLUDED."peakStreamNps",
      "peakJumpStrain"=EXCLUDED."peakJumpStrain",
      "peakStreamStrain"=EXCLUDED."peakStreamStrain",
      "jumpRatio"=EXCLUDED."jumpRatio",
      "rpl"=EXCLUDED."rpl",
      "rpv"=EXCLUDED."rpv",
      "rps"=EXCLUDED."rps",
      "speedProfiles"=EXCLUDED."speedProfiles",
      "topSections"=EXCLUDED."topSections",
      "patternSegments"=EXCLUDED."patternSegments",
      "analysisDetails"=EXCLUDED."analysisDetails",
      "error"=NULL,
      "analyzedAt"=CURRENT_TIMESTAMP,
      "updatedAt"=CURRENT_TIMESTAMP
    `,
    mapId,
    analysis.version,
    sourceStatus,
    eligible,
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
    JSON.stringify(analysis.details),
  );

  await prisma.challengeMap.update({
    where: { id: mapId },
    data: {
      rating: analysis.rating,
      requestedRating: analysis.rating,
      noteCount: analysis.noteCount,
    },
  });

  return getMapAnalysis(mapId);
}

export async function markMapAnalysisFailed(mapId: string, sourceStatus: string, error: string) {
  await ensureMapAnalysisTable();
  await prisma.$executeRawUnsafe(
    `
    INSERT INTO "MapDifficultyAnalysis" (
      "mapId","analyzerVersion","status","sourceStatus","pointEligible","error","updatedAt"
    )
    VALUES ($1,$2,'failed',$3,FALSE,$4,CURRENT_TIMESTAMP)
    ON CONFLICT ("mapId") DO UPDATE SET
      "analyzerVersion"=EXCLUDED."analyzerVersion",
      "status"='failed',
      "sourceStatus"=EXCLUDED."sourceStatus",
      "pointEligible"=FALSE,
      "rating"=NULL,
      "directionScore"=NULL,
      "distanceScore"=NULL,
      "npsScore"=NULL,
      "staminaIndex"=NULL,
      "activeDurationMs"=NULL,
      "longestHardSectionMs"=NULL,
      "peakJumpNps"=NULL,
      "peakStreamNps"=NULL,
      "peakJumpStrain"=NULL,
      "peakStreamStrain"=NULL,
      "jumpRatio"=NULL,
      "rpl"=NULL,
      "rpv"=NULL,
      "rps"=NULL,
      "speedProfiles"='[]'::jsonb,
      "topSections"='[]'::jsonb,
      "patternSegments"='[]'::jsonb,
      "analysisDetails"='{}'::jsonb,
      "error"=EXCLUDED."error",
      "analyzedAt"=NULL,
      "updatedAt"=CURRENT_TIMESTAMP
    `,
    mapId,
    MAP_ANALYZER_VERSION,
    sourceStatus,
    error.slice(0, 1000),
  );

  await prisma.challengeMap
    .update({ where: { id: mapId }, data: { rating: null, requestedRating: 0 } })
    .catch(() => null);
}

export async function setMapPointEligibility(mapId: string, pointEligible: boolean) {
  await ensureMapAnalysisTable();
  const analysis = await getMapAnalysis(mapId);
  if (!analysisIsCurrent(analysis)) {
    throw new Error("Analyze this map with the current analyzer before changing rank-point eligibility.");
  }
  if (pointEligible && analysis?.sourceStatus !== "ranked") {
    throw new Error("Only ranked maps can award RPL, RPV, RPS, or RHP.");
  }

  await prisma.$executeRawUnsafe(
    'UPDATE "MapDifficultyAnalysis" SET "pointEligible"=$2,"updatedAt"=CURRENT_TIMESTAMP WHERE "mapId"=$1',
    mapId,
    pointEligible,
  );
  return getMapAnalysis(mapId);
}

async function downloadMap(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        accept: "application/octet-stream,application/zip,application/json,text/plain;q=0.95,*/*;q=0.1",
        "user-agent": `Rhythians-MapAnalyzer/${MAP_ANALYZER_VERSION}.0`,
      },
    });

    if (!response.ok) throw new Error(`Map download returned HTTP ${response.status}.`);
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (contentType.includes("text/html")) {
      throw new Error("Map source returned an HTML page instead of raw map data.");
    }

    const length = Number(response.headers.get("content-length") ?? 0);
    if (Number.isFinite(length) && length > 64 * 1024 * 1024) {
      throw new Error("Map file is too large to analyze safely.");
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.byteLength) throw new Error("Map source returned an empty file.");
    if (bytes.byteLength > 64 * 1024 * 1024) {
      throw new Error("Map file is too large to analyze safely.");
    }

    const prefix = new TextDecoder()
      .decode(bytes.slice(0, Math.min(128, bytes.length)))
      .trimStart()
      .toLowerCase();
    if (prefix.startsWith("<!doctype html") || prefix.startsWith("<html")) {
      throw new Error("Map source returned an HTML page instead of raw map data.");
    }

    return bytes;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveMapAssets(map: {
  id: string;
  mapFileUrl: string;
  imageUrl: string | null;
  mapperName: string | null;
  noteCount: number | null;
  length: number | null;
  sourceBeatmapId: number | null;
}) {
  if (map.sourceBeatmapId == null) return map;

  let resolved: Awaited<ReturnType<typeof resolveRhythiaMapSource>> | null = null;
  try {
    resolved = await resolveRhythiaMapSource(sourceApiId(map.sourceBeatmapId));
  } catch {}

  if (!resolved) return map;

  const mapFileUrl = resolved.mapFileUrl ?? map.mapFileUrl;
  const imageUrl = resolved.imageUrl ?? map.imageUrl;
  const mapperName = resolved.mapperName ?? map.mapperName;
  const noteCount = resolved.noteCount ?? map.noteCount;
  const length = resolved.length ?? map.length;

  if (
    mapFileUrl !== map.mapFileUrl ||
    imageUrl !== map.imageUrl ||
    mapperName !== map.mapperName ||
    noteCount !== map.noteCount ||
    length !== map.length
  ) {
    await prisma.challengeMap.update({
      where: { id: map.id },
      data: { mapFileUrl, imageUrl, mapperName, noteCount, length },
    });
  }

  return { ...map, mapFileUrl, imageUrl, mapperName, noteCount, length };
}

export async function analyzeChallengeMap(mapId: string) {
  const map = await prisma.challengeMap.findUnique({
    where: { id: mapId },
    select: {
      id: true,
      mapFileUrl: true,
      imageUrl: true,
      mapperName: true,
      noteCount: true,
      length: true,
      sourceBeatmapId: true,
      reviewerNote: true,
      status: true,
    },
  });
  if (!map) throw new Error("Map not found.");

  const sourceStatus =
    map.reviewerNote === UNRANKED_MAP_MARKER
      ? "unranked"
      : map.status === "legacy"
        ? "legacy"
        : "ranked";

  try {
    const resolved = await resolveMapAssets(map);
    if (looksLikeMapPage(resolved.mapFileUrl)) {
      throw new Error("Rhythia did not expose downloadable SSPM/RHM/text map data for this map.");
    }

    const bytes = await downloadMap(resolved.mapFileUrl);
    const analysis = analyzeMapBytes(bytes);
    return await saveMapAnalysis(map.id, sourceStatus, analysis);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Map analysis failed.";
    await markMapAnalysisFailed(map.id, sourceStatus, message);
    throw new Error(message);
  }
}
