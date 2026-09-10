import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { setMapPointEligibility } from "@/lib/map-analysis-store";
import { recalculateUsersForMapAnalysis } from "@/lib/rhythia-mode-points";

type Props = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Props) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!(await canAccessAdmin(user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as { pointEligible?: unknown } | null;
  if (typeof body?.pointEligible !== "boolean") return NextResponse.json({ error: "pointEligible must be a boolean." }, { status: 400 });
  const { id } = await params;
  try {
    const analysis = await setMapPointEligibility(id, body.pointEligible);
    const recalculated = await recalculateUsersForMapAnalysis(id);
    return NextResponse.json({ analysis, recalculatedUsers: recalculated.users });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update point eligibility." }, { status: 400 });
  }
}
