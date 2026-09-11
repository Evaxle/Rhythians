import { NextResponse } from "next/server";
import { analyzeMaps, getAllMapAnalysisStats, type AnalysisSource } from "@/lib/map-analysis-refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PRIORITY: AnalysisSource[] = ["ranked", "unranked", "legacy"];

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return request.headers.get("x-vercel-cron") === "1";
  const url = new URL(request.url);
  const bearer = request.headers.get("authorization");
  return bearer === `Bearer ${secret}` || url.searchParams.get("secret") === secret || request.headers.get("x-cron-secret") === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const deadline = Date.now() + 45_000;
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  const bySource: Record<string, { processed: number; succeeded: number; failed: number }> = {};

  try {
    while (Date.now() < deadline) {
      let worked = false;

      for (const source of PRIORITY) {
        if (Date.now() >= deadline) break;
        const before = await getAllMapAnalysisStats(source);
        if (before.pending <= 0) continue;

        const result = await analyzeMaps(2, source);
        bySource[source] ??= { processed: 0, succeeded: 0, failed: 0 };
        bySource[source].processed += result.processed;
        bySource[source].succeeded += result.succeeded;
        bySource[source].failed += result.failed;
        processed += result.processed;
        succeeded += result.succeeded;
        failed += result.failed;
        worked = result.processed > 0;
        break;
      }

      if (!worked) break;
    }

    return NextResponse.json({
      success: true,
      priority: PRIORITY,
      processed,
      succeeded,
      failed,
      bySource,
      stoppedForTimeBudget: Date.now() >= deadline,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("automatic map analysis failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Automatic map analysis failed.", processed, succeeded, failed, bySource },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
