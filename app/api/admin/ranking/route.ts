import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { applyRankingReset, loadRankingConfig, previewRankingReset } from "@/lib/ranking-system";
import { getRankInfo } from "@/lib/ranks";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), user: null };
  if (!(await canAccessAdmin(user))) return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }), user: null };
  return { response: null, user };
}
function summarize(rows: Awaited<ReturnType<typeof previewRankingReset>>) {
  const ranks = new Map<string, number>();
  for (const row of rows) { const name = getRankInfo(row.newRhp).name; ranks.set(name, (ranks.get(name) ?? 0) + 1); }
  return { users: rows.length, ranks: Object.fromEntries(ranks), min: rows.length ? Math.min(...rows.map((row) => row.newRhp)) : 0, max: rows.length ? Math.max(...rows.map((row) => row.newRhp)) : 0 };
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const config = await loadRankingConfig();
  const rows = await previewRankingReset(config);
  return NextResponse.json({ config, summary: summarize(rows), rows: rows.slice().sort((a, b) => b.newRhp - a.newRhp).slice(0, 100) });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.response || !auth.user) return auth.response!;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const config = await loadRankingConfig();
  if (body?.action !== "reset") {
    const rows = await previewRankingReset(config);
    return NextResponse.json({ config, summary: summarize(rows), rows: rows.slice().sort((a, b) => b.newRhp - a.newRhp).slice(0, 100) });
  }
  if (body?.confirmation !== "RECALCULATE RANKS") return NextResponse.json({ error: "Type RECALCULATE RANKS to confirm the full analyzed-map recalculation." }, { status: 400 });
  const result = await applyRankingReset(auth.user.id, config);
  return NextResponse.json({ ok: true, config, resetId: result.resetId, users: result.users, summary: summarize(result.preview) });
}
