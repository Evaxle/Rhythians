import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { analyzePendingRankedMaps, getRankedAnalysisStats } from "@/lib/map-analysis-store";

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
  return NextResponse.json({ stats: await getRankedAnalysisStats() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await authorize();
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null) as { limit?: unknown } | null;
  const limit = Math.max(1, Math.min(10, Number(body?.limit) || 5));
  try {
    return NextResponse.json(await analyzePendingRankedMaps(limit));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ranked map analysis failed." }, { status: 400 });
  }
}
