import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { analyzeMapBytes, MAP_ANALYZER_VERSION } from "@/lib/map-difficulty";
import { getRankedAnalysisStats, markMapAnalysisFailed, saveMapAnalysis, UNRANKED_MAP_MARKER } from "@/lib/map-analysis-store";
import { syncRhythiaMaps } from "@/lib/rhythia-map-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Candidate = { id: string; mapFileUrl: string };
type RhythiaStatus = "RANKED" | "UNRANKED" | "LEGACY";
const SYNC_START_KEY = "ranking_v3_production_ranked_sync_started_at";

async function analyzeOne(map: Candidate) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(map.mapFileUrl, { cache: "no-store", redirect: "follow", signal: controller.signal });
    if (!response.ok) throw new Error(`Map download returned HTTP ${response.status}.`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.byteLength) throw new Error("Map source returned an empty file.");
    if (bytes.byteLength > 64 * 1024 * 1024) throw new Error("Map file is too large to analyze safely.");
    const analysis = analyzeMapBytes(bytes);
    await saveMapAnalysis(map.id, "ranked", analysis);
    return { id: map.id, ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Map analysis failed.";
    await markMapAnalysisFailed(map.id, "ranked", message).catch(() => null);
    return { id: map.id, ok: false as const, error: message };
  } finally {
    clearTimeout(timeout);
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
    results.push(...await Promise.all(candidates.slice(index, index + 10).map(analyzeOne)));
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
