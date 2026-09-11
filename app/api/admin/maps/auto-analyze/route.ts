import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { analyzeMaps, getAllMapAnalysisStats, type AnalysisSource } from "@/lib/map-analysis-refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PRIORITY: AnalysisSource[] = ["ranked", "unranked", "legacy"];

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canAccessAdmin(user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    for (const source of PRIORITY) {
      const before = await getAllMapAnalysisStats(source);
      if (before.pending <= 0) continue;

      const result = await analyzeMaps(2, source);
      return NextResponse.json({
        success: true,
        done: false,
        source,
        priority: PRIORITY,
        processed: result.processed,
        succeeded: result.succeeded,
        failed: result.failed,
        stats: result.stats,
        errors: result.errors,
      }, { headers: { "Cache-Control": "no-store" } });
    }

    const stats = await Promise.all(PRIORITY.map((source) => getAllMapAnalysisStats(source)));
    return NextResponse.json({
      success: true,
      done: true,
      source: null,
      priority: PRIORITY,
      processed: 0,
      succeeded: 0,
      failed: 0,
      allStats: Object.fromEntries(stats.map((item) => [item.source, item])),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("admin automatic map analysis failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Automatic map analysis failed." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
