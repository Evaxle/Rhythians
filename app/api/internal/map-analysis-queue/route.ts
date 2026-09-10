import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { claimPendingMapAnalysisIds, getAllAnalysisStats } from "@/lib/map-analysis-store";
import { analyzeLegacyChallengeMap } from "@/lib/legacy-map-analysis";
import { syncRhythiaMaps } from "@/lib/rhythia-map-sync";
import { recalculateUsersForMapAnalysis } from "@/lib/rhythia-mode-points";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const IDLE_SYNC_MS = 5 * 60 * 1000;
const DATABASE_CRON_KEY = "map_analysis_cron_token";

async function isAuthorized(request: Request) {
  const url = new URL(request.url);
  const bearer = request.headers.get("authorization");
  const supplied = url.searchParams.get("token") ?? url.searchParams.get("secret") ?? request.headers.get("x-cron-secret");
  const environmentSecret = process.env.CRON_SECRET;
  if (environmentSecret && (bearer === `Bearer ${environmentSecret}` || supplied === environmentSecret)) return true;
  if (!environmentSecret && request.headers.get("x-vercel-cron") === "1") return true;
  if (!supplied) return false;
  const databaseToken = await prisma.siteSetting.findUnique({ where: { key: DATABASE_CRON_KEY }, select: { value: true } }).catch(() => null);
  return Boolean(databaseToken?.value && supplied === databaseToken.value);
}

async function refreshRhythiaIfIdle() {
  const setting = await prisma.siteSetting.findUnique({ where: { key: "rankability_idle_map_sync_last_run" }, select: { value: true } });
  const previous = setting?.value ? new Date(setting.value).getTime() : 0;
  if (Number.isFinite(previous) && Date.now() - previous < IDLE_SYNC_MS) return null;
  const result = await syncRhythiaMaps();
  const now = new Date().toISOString();
  await prisma.siteSetting.upsert({ where: { key: "rankability_idle_map_sync_last_run" }, update: { value: now }, create: { key: "rankability_idle_map_sync_last_run", value: now, description: "Last Rhythia catalog refresh triggered after the map-analysis queue became idle." } });
  return result;
}

export async function GET(request: Request) {
  if (!(await isAuthorized(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let ids = await claimPendingMapAnalysisIds(5);
  let sync: Awaited<ReturnType<typeof syncRhythiaMaps>> | null = null;
  if (!ids.length) {
    try { sync = await refreshRhythiaIfIdle(); } catch (error) { console.error("Idle Rhythia map sync failed", error); }
    if (sync) ids = await claimPendingMapAnalysisIds(5);
  }

  let succeeded = 0;
  let failed = 0;
  let recalculatedUsers = 0;
  const results: Array<{ mapId: string; ok: boolean; rating?: number | null; rankability?: number | null; pointEligible?: boolean; error?: string }> = [];
  for (const mapId of ids) {
    try {
      const analysis = await analyzeLegacyChallengeMap(mapId);
      const recalculated = await recalculateUsersForMapAnalysis(mapId).catch(() => ({ users: 0 }));
      recalculatedUsers += recalculated.users;
      succeeded += 1;
      results.push({ mapId, ok: true, rating: analysis?.rating ?? null, rankability: analysis?.rankabilityScore ?? null, pointEligible: analysis?.pointEligible ?? false });
    } catch (error) {
      failed += 1;
      results.push({ mapId, ok: false, error: error instanceof Error ? error.message : "Map analysis failed." });
    }
  }

  return NextResponse.json({ success: true, processed: ids.length, succeeded, failed, recalculatedUsers, sync, results, stats: await getAllAnalysisStats() });
}
