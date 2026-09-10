import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { analyzePendingMaps, getAllMapAnalysisStats } from "@/lib/map-analysis-refresh";
import { recalculateUsersForMapAnalysis } from "@/lib/rhythia-mode-points";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function authorize() {
  const user = await getSessionUser();
  if (!user) return { user: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!(await canAccessAdmin(user))) return { user: null, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user, response: null };
}

export async function GET() {
  const auth = await authorize();
  if (auth.response) return auth.response;
  return NextResponse.json({ stats: await getAllMapAnalysisStats() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await authorize();
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null) as { limit?: unknown } | null;
  const limit = Math.max(1, Math.min(2, Number(body?.limit) || 2));
  try {
    const result = await analyzePendingMaps(limit);
    let recalculatedUsers = 0;
    for (const mapId of [...result.succeededMapIds, ...result.failedMapIds]) {
      const recalculated = await recalculateUsersForMapAnalysis(mapId);
      recalculatedUsers += recalculated.users;
    }
    return NextResponse.json({ ...result, recalculatedUsers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Map analysis failed." }, { status: 400 });
  }
}
