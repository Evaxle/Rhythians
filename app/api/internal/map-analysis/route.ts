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

  try {
    for (const source of PRIORITY) {
      const before = await getAllMapAnalysisStats(source);
      if (before.pending <= 0) continue;

      const result = await analyzeMaps(6, source);
      return NextResponse.json({
        success: true,
        source,
        priority: PRIORITY,
        processed: result.processed,
        succeeded: result.succeeded,
        failed: result.failed,
        errors: result.errors,
        stats: result.stats,
      }, { headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json({
      success: true,
      source: null,
      priority: PRIORITY,
      processed: 0,
      succeeded: 0,
      failed: 0,
      message: "All ranked, unranked, and legacy maps are current.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("automatic map analysis failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Automatic map analysis failed." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
