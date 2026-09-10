import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { analyzeLegacyChallengeMap } from "@/lib/legacy-map-analysis";
import { MAP_ANALYZER_VERSION } from "@/lib/map-difficulty";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Candidate = { id: string };

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== "preview" || process.env.VERCEL_GIT_COMMIT_REF !== "map-analysis-timeline-details") return NextResponse.json({ error: "Not available." }, { status: 404 });
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(160, Number(url.searchParams.get("limit")) || 120));
  const candidates = await prisma.$queryRawUnsafe<Candidate[]>(`
    SELECT c.id FROM "ChallengeMap" c
    LEFT JOIN "MapDifficultyAnalysis" a ON a."mapId"=c.id
    WHERE c.status='legacy'
      AND (a."mapId" IS NULL OR a."analyzerVersion"<>$1 OR a.status<>'analyzed' OR a."sourceStatus"<>'legacy')
    ORDER BY c."updatedAt" ASC,c.id ASC
    LIMIT $2`, MAP_ANALYZER_VERSION, limit);
  const started = Date.now();
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  for (let index = 0; index < candidates.length; index += 10) {
    if (Date.now() - started > 45000) break;
    const batch = await Promise.all(candidates.slice(index, index + 10).map(async (map) => {
      try {
        await analyzeLegacyChallengeMap(map.id);
        return { id: map.id, ok: true };
      } catch (error) {
        return { id: map.id, ok: false, error: error instanceof Error ? error.message : "Legacy map analysis failed." };
      }
    }));
    results.push(...batch);
  }
  const stats = await prisma.$queryRawUnsafe<Array<{ total: bigint; analyzed: bigint; failed: bigint; remaining: bigint }>>(`
    SELECT COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE a.status='analyzed' AND a."sourceStatus"='legacy' AND a."analyzerVersion"=$1)::bigint AS analyzed,
      COUNT(*) FILTER (WHERE a.status='failed' AND a."sourceStatus"='legacy' AND a."analyzerVersion"=$1)::bigint AS failed,
      COUNT(*) FILTER (WHERE a."mapId" IS NULL OR a."analyzerVersion"<>$1 OR a.status<>'analyzed' OR a."sourceStatus"<>'legacy')::bigint AS remaining
    FROM "ChallengeMap" c LEFT JOIN "MapDifficultyAnalysis" a ON a."mapId"=c.id WHERE c.status='legacy'`, MAP_ANALYZER_VERSION);
  const row = stats[0] ?? { total: 0n, analyzed: 0n, failed: 0n, remaining: 0n };
  return NextResponse.json({ processed: results.length, succeeded: results.filter((result) => result.ok).length, failed: results.filter((result) => !result.ok).length, errors: results.filter((result) => !result.ok).slice(0, 20), stats: { total: Number(row.total), analyzed: Number(row.analyzed), failed: Number(row.failed), remaining: Number(row.remaining) } });
}
