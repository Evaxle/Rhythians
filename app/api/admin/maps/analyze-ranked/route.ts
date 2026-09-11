import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { analyzeMaps, getAllMapAnalysisStats, type AnalysisSource } from "@/lib/map-analysis-refresh";
import { recalculateUsersForMapAnalysis } from "@/lib/rhythia-mode-points";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function authorize() {
  const user = await getSessionUser();
  if (!user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!(await canAccessAdmin(user))) return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { response: null };
}

function parseSource(value: unknown): AnalysisSource {
  return value === "all" || value === "unranked" || value === "legacy" ? value : "ranked";
}

export async function GET(request: Request) {
  const auth = await authorize();
  if (auth.response) return auth.response;

  const source = parseSource(new URL(request.url).searchParams.get("source"));
  return NextResponse.json(
    { stats: await getAllMapAnalysisStats(source) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const auth = await authorize();
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null) as {
    limit?: unknown;
    source?: unknown;
    force?: unknown;
    cursor?: unknown;
  } | null;

  const limit = Math.max(1, Math.min(2, Number(body?.limit) || 2));
  const source = parseSource(body?.source);
  const force = body?.force === true;
  const cursor = typeof body?.cursor === "string" && body.cursor ? body.cursor : null;

  try {
    const result = await analyzeMaps(limit, source, { force, cursor });
    let recalculatedUsers = 0;

    for (const mapId of result.succeededMapIds) {
      const recalculated = await recalculateUsersForMapAnalysis(mapId);
      recalculatedUsers += recalculated.users;
    }

    return NextResponse.json({ ...result, recalculatedUsers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Map analysis failed." },
      { status: 400 },
    );
  }
}
