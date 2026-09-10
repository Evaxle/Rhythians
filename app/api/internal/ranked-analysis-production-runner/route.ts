import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { analyzeMapBytes, MAP_ANALYZER_VERSION } from "@/lib/map-difficulty";
import { getRankedAnalysisStats, markMapAnalysisFailed, saveMapAnalysis, UNRANKED_MAP_MARKER } from "@/lib/map-analysis-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Candidate = { id: string; mapFileUrl: string };

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

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== "preview" || process.env.VERCEL_GIT_COMMIT_REF !== "ranking-v3-map-analysis") return NextResponse.json({ error: "Not available." }, { status: 404 });
  const url = new URL(request.url);
  const retryFailed = url.searchParams.get("retry") === "1";
  const limit = Math.max(1, Math.min(160, Number(url.searchParams.get("limit")) || 120));
  const candidates = await prisma.$queryRawUnsafe<Candidate[]>(`
    SELECT c.id,c."mapFileUrl" FROM "ChallengeMap" c
    LEFT JOIN "MapDifficultyAnalysis" a ON a."mapId"=c.id
    WHERE c.status='approved' AND c."reviewerNote" IS DISTINCT FROM $1
      AND ${retryFailed ? `(a.status='failed' AND a."analyzerVersion"=$2)` : `(a."mapId" IS NULL OR a."analyzerVersion" <> $2 OR a.status='unanalyzed')`}
    ORDER BY c."updatedAt" ASC,c.id ASC
    LIMIT $3`, UNRANKED_MAP_MARKER, MAP_ANALYZER_VERSION, limit);
  const started = Date.now();
  const results: Awaited<ReturnType<typeof analyzeOne>>[] = [];
  for (let index = 0; index < candidates.length; index += 10) {
    if (Date.now() - started > 45000) break;
    results.push(...await Promise.all(candidates.slice(index, index + 10).map(analyzeOne)));
  }
  const stats = await getRankedAnalysisStats();
  return NextResponse.json({ processed: results.length, succeeded: results.filter((result) => result.ok).length, failed: results.filter((result) => !result.ok).length, errors: results.filter((result) => !result.ok).slice(0, 20), stats });
}
