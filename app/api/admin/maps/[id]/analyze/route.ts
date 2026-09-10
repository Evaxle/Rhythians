import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { analyzeLegacyChallengeMap } from "@/lib/legacy-map-analysis";
import { recalculateUsersForMapAnalysis } from "@/lib/rhythia-mode-points";

export const runtime = "nodejs";
type Props = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Props) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!(await canAccessAdmin(user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  try {
    const analysis = await analyzeLegacyChallengeMap(id);
    const recalculated = await recalculateUsersForMapAnalysis(id);
    return NextResponse.json({ analysis, recalculatedUsers: recalculated.users });
  } catch (error) {
    const recalculated = await recalculateUsersForMapAnalysis(id).catch(() => ({ users: 0 }));
    return NextResponse.json({ error: error instanceof Error ? error.message : "Map analysis failed.", recalculatedUsers: recalculated.users }, { status: 400 });
  }
}
