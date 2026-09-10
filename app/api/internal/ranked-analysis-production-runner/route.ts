import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { analyzeMapBytes, analyzeMapNotes, MAP_ANALYZER_VERSION, type MapNote } from "@/lib/map-difficulty";
import { getRankedAnalysisStats, markMapAnalysisFailed, saveMapAnalysis, setMapPointEligibility, UNRANKED_MAP_MARKER } from "@/lib/map-analysis-store";
import { syncRhythiaMaps } from "@/lib/rhythia-map-sync";
import { recalculateUsersForMapAnalysis } from "@/lib/rhythia-mode-points";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Candidate = { id: string; mapFileUrl: string };
type RhythiaStatus = "RANKED" | "UNRANKED" | "LEGACY";
type MarkerDefinition = { id: string; types: number[] };
const SYNC_START_KEY = "ranking_v3_production_ranked_sync_started_at";

function readString16(buffer: Buffer, cursor: number) {
  if (cursor + 2 > buffer.length) throw new Error("Invalid SSPM string.");
  const length = buffer.readUInt16LE(cursor);
  cursor += 2;
  if (cursor + length > buffer.length) throw new Error("Invalid SSPM string length.");
  return { value: buffer.subarray(cursor, cursor + length).toString("utf8"), cursor: cursor + length };
}

function skipMarkerValue(buffer: Buffer, cursor: number, type: number) {
  if (type === 0x01) cursor += 1;
  else if (type === 0x02) cursor += 2;
  else if (type === 0x03 || type === 0x05) cursor += 4;
  else if (type === 0x04 || type === 0x06) cursor += 8;
  else if (type === 0x08 || type === 0x09) {
    if (cursor + 2 > buffer.length) throw new Error("Invalid SSPM buffer value.");
    cursor += 2 + buffer.readUInt16LE(cursor);
  } else if (type === 0x0a || type === 0x0b) {
    if (cursor + 4 > buffer.length) throw new Error("Invalid SSPM long value.");
    cursor += 4 + buffer.readUInt32LE(cursor);
  } else if (type === 0x0c) throw new Error("SSPM marker arrays are not supported.");
  else throw new Error(`Unsupported SSPM marker value type ${type}.`);
  if (cursor > buffer.length) throw new Error("Invalid SSPM marker value length.");
  return cursor;
}

function parseSspmSections(definitionsData: Uint8Array, markersData: Uint8Array, markerCount: number): MapNote[] {
  const definitionsBuffer = Buffer.from(definitionsData);
  let cursor = 0;
  if (!definitionsBuffer.length) throw new Error("SSPM map has no marker definitions.");
  const definitionCount = definitionsBuffer[cursor++];
  const definitions: MarkerDefinition[] = [];
  for (let i = 0; i < definitionCount; i += 1) {
    const name = readString16(definitionsBuffer, cursor);
    cursor = name.cursor;
    if (cursor >= definitionsBuffer.length) throw new Error("Invalid SSPM marker definition.");
    const valueCount = definitionsBuffer[cursor++];
    const types: number[] = [];
    for (let j = 0; j < valueCount; j += 1) {
      if (cursor >= definitionsBuffer.length) throw new Error("Invalid SSPM marker definition values.");
      const type = definitionsBuffer[cursor++];
      types.push(type);
      if (type === 0x0c) {
        if (cursor >= definitionsBuffer.length) throw new Error("Invalid SSPM array definition.");
        cursor += 1;
      }
    }
    if (cursor >= definitionsBuffer.length || definitionsBuffer[cursor++] !== 0) throw new Error("Invalid SSPM marker definition terminator.");
    definitions.push({ id: name.value, types });
  }
  const noteType = definitions.findIndex((definition) => definition.id === "ssp_note");
  if (noteType < 0) throw new Error("SSPM map does not define ssp_note markers.");
  const markerBuffer = Buffer.from(markersData);
  cursor = 0;
  const notes: MapNote[] = [];
  for (let marker = 0; marker < markerCount && cursor < markerBuffer.length; marker += 1) {
    if (cursor + 5 > markerBuffer.length) throw new Error("Invalid SSPM marker block.");
    const time = markerBuffer.readUInt32LE(cursor);
    cursor += 4;
    const markerType = markerBuffer[cursor++];
    const definition = definitions[markerType];
    if (!definition) throw new Error("SSPM marker references an unknown definition.");
    let position: { x: number; y: number } | null = null;
    for (const type of definition.types) {
      if (type === 0x07) {
        if (cursor + 1 > markerBuffer.length) throw new Error("Invalid SSPM position marker.");
        const encoding = markerBuffer[cursor++];
        if (encoding === 0) {
          if (cursor + 2 > markerBuffer.length) throw new Error("Invalid SSPM integer position.");
          const x = markerBuffer[cursor++];
          const y = markerBuffer[cursor++];
          if (!position) position = { x, y };
        } else if (encoding === 1) {
          if (cursor + 8 > markerBuffer.length) throw new Error("Invalid SSPM quantum position.");
          const x = markerBuffer.readFloatLE(cursor);
          const y = markerBuffer.readFloatLE(cursor + 4);
          cursor += 8;
          if (!position) position = { x, y };
        } else throw new Error("Invalid SSPM position encoding.");
      } else cursor = skipMarkerValue(markerBuffer, cursor, type);
    }
    if (markerType === noteType && position && Number.isFinite(position.x) && Number.isFinite(position.y)) notes.push({ time, x: position.x, y: position.y });
  }
  return notes.sort((a, b) => a.time - b.time);
}

async function fetchRange(url: string, start: number, end: number) {
  const response = await fetch(url, { cache: "no-store", redirect: "follow", headers: { range: `bytes=${start}-${end}` } });
  if (response.status !== 206) throw new Error("Map source does not support safe ranged analysis.");
  return new Uint8Array(await response.arrayBuffer());
}

async function analyzeOversizedSspm(url: string) {
  const header = Buffer.from(await fetchRange(url, 0, 127));
  if (header.length < 128 || header.readUInt32LE(0) !== 0x6d2b5353 || header.readUInt16LE(4) !== 2) throw new Error("Oversized map is not a supported SSPM v2 file.");
  const markerCount = header.readUInt32LE(38);
  const definitionsOffset = Number(header.readBigUInt64LE(96));
  const definitionsLength = Number(header.readBigUInt64LE(104));
  const markersOffset = Number(header.readBigUInt64LE(112));
  const markersLength = Number(header.readBigUInt64LE(120));
  if (![definitionsOffset, definitionsLength, markersOffset, markersLength].every(Number.isSafeInteger)) throw new Error("SSPM section offsets are outside the safe integer range.");
  if (definitionsLength <= 0 || definitionsLength > 1024 * 1024) throw new Error("SSPM marker definitions are too large to analyze safely.");
  if (markersLength <= 0 || markersLength > 64 * 1024 * 1024) throw new Error("SSPM marker section is too large to analyze safely.");
  const [definitions, markers] = await Promise.all([
    fetchRange(url, definitionsOffset, definitionsOffset + definitionsLength - 1),
    fetchRange(url, markersOffset, markersOffset + markersLength - 1),
  ]);
  return analyzeMapNotes(parseSspmSections(definitions, markers, markerCount));
}

async function analyzeOne(map: Candidate, ranged = false) {
  try {
    const analysis = ranged ? await analyzeOversizedSspm(map.mapFileUrl) : await (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch(map.mapFileUrl, { cache: "no-store", redirect: "follow", signal: controller.signal });
        if (!response.ok) throw new Error(`Map download returned HTTP ${response.status}.`);
        const declared = Number(response.headers.get("content-length") ?? 0);
        if (Number.isFinite(declared) && declared > 64 * 1024 * 1024) {
          await response.body?.cancel();
          return analyzeOversizedSspm(map.mapFileUrl);
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (!bytes.byteLength) throw new Error("Map source returned an empty file.");
        if (bytes.byteLength > 64 * 1024 * 1024) return analyzeOversizedSspm(map.mapFileUrl);
        return analyzeMapBytes(bytes);
      } finally {
        clearTimeout(timeout);
      }
    })();
    await saveMapAnalysis(map.id, "ranked", analysis);
    return { id: map.id, ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Map analysis failed.";
    await markMapAnalysisFailed(map.id, "ranked", message).catch(() => null);
    return { id: map.id, ok: false as const, error: message };
  }
}

async function rankedSyncStart() {
  const row = await prisma.siteSetting.findUnique({ where: { key: SYNC_START_KEY }, select: { value: true } });
  const date = row?.value ? new Date(row.value) : null;
  return date && Number.isFinite(date.getTime()) ? date : null;
}

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== "preview" || process.env.VERCEL_GIT_COMMIT_REF !== "ranking-v3-map-analysis") return NextResponse.json({ error: "Not available." }, { status: 404 });
  const url = new URL(request.url);
  const action = url.searchParams.get("action") ?? "analyze";
  if (action === "sync") {
    const status = url.searchParams.get("status") as RhythiaStatus | null;
    if (status !== "RANKED" && status !== "UNRANKED" && status !== "LEGACY") return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    if (status === "RANKED") {
      const started = new Date().toISOString();
      await prisma.siteSetting.upsert({ where: { key: SYNC_START_KEY }, update: { value: started }, create: { key: SYNC_START_KEY, value: started, description: "Temporary exact-ranked production analysis boundary." } });
    }
    return NextResponse.json({ action, status, ...(await syncRhythiaMaps(status)) });
  }
  const syncStart = await rankedSyncStart();
  if (!syncStart) return NextResponse.json({ error: "Run the RANKED sync first." }, { status: 409 });
  if (action === "finalize") {
    const stale = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`
      SELECT c.id FROM "ChallengeMap" c JOIN "MapDifficultyAnalysis" a ON a."mapId"=c.id
      WHERE a."pointEligible"=TRUE AND a."sourceStatus"='ranked'
        AND NOT (c."isAutoImported"=TRUE AND c."sourceBeatmapId" IS NOT NULL AND c."updatedAt">=$1)`, syncStart);
    let recalculatedUsers = 0;
    for (const map of stale) {
      await setMapPointEligibility(map.id, false);
      recalculatedUsers += (await recalculateUsersForMapAnalysis(map.id)).users;
    }
    return NextResponse.json({ disabled: stale.length, recalculatedUsers });
  }
  const retryFailed = url.searchParams.get("retry") === "1";
  const limit = Math.max(1, Math.min(160, Number(url.searchParams.get("limit")) || 120));
  const candidates = await prisma.$queryRawUnsafe<Candidate[]>(`
    SELECT c.id,c."mapFileUrl" FROM "ChallengeMap" c
    LEFT JOIN "MapDifficultyAnalysis" a ON a."mapId"=c.id
    WHERE c.status='approved' AND c."isAutoImported"=TRUE AND c."sourceBeatmapId" IS NOT NULL
      AND c."reviewerNote" IS DISTINCT FROM $1 AND c."updatedAt">=$4
      AND ${retryFailed ? `(a.status='failed' AND a."analyzerVersion"=$2)` : `(a."mapId" IS NULL OR a."analyzerVersion" <> $2 OR a.status='unanalyzed')`}
    ORDER BY c."updatedAt" ASC,c.id ASC
    LIMIT $3`, UNRANKED_MAP_MARKER, MAP_ANALYZER_VERSION, limit, syncStart);
  const started = Date.now();
  const results: Awaited<ReturnType<typeof analyzeOne>>[] = [];
  for (let index = 0; index < candidates.length; index += 10) {
    if (Date.now() - started > 45000) break;
    results.push(...await Promise.all(candidates.slice(index, index + 10).map((map) => analyzeOne(map, retryFailed))));
  }
  const stats = await getRankedAnalysisStats();
  const exact = await prisma.$queryRawUnsafe<Array<{ total: bigint; analyzed: bigint; failed: bigint; remaining: bigint }>>(`
    SELECT COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE a.status='analyzed' AND a."analyzerVersion"=$2 AND a."pointEligible"=TRUE)::bigint AS analyzed,
      COUNT(*) FILTER (WHERE a.status='failed' AND a."analyzerVersion"=$2)::bigint AS failed,
      COUNT(*) FILTER (WHERE a."mapId" IS NULL OR a."analyzerVersion"<>$2 OR a.status='unanalyzed')::bigint AS remaining
    FROM "ChallengeMap" c LEFT JOIN "MapDifficultyAnalysis" a ON a."mapId"=c.id
    WHERE c.status='approved' AND c."isAutoImported"=TRUE AND c."sourceBeatmapId" IS NOT NULL
      AND c."reviewerNote" IS DISTINCT FROM $1 AND c."updatedAt">=$3`, UNRANKED_MAP_MARKER, MAP_ANALYZER_VERSION, syncStart);
  const row = exact[0] ?? { total: 0n, analyzed: 0n, failed: 0n, remaining: 0n };
  return NextResponse.json({ processed: results.length, succeeded: results.filter((result) => result.ok).length, failed: results.filter((result) => !result.ok).length, errors: results.filter((result) => !result.ok).slice(0, 20), exact: { total: Number(row.total), analyzed: Number(row.analyzed), failed: Number(row.failed), remaining: Number(row.remaining) }, stats });
}
