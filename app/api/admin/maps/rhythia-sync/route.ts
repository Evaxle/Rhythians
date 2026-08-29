import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { syncAndAutoReviewRhythiaMaps } from "@/lib/rhythia-auto-review";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = await getSessionUser();
  if (!admin) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!(await canAccessAdmin(admin))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const body = await request.json().catch(() => null) as { status?: unknown } | null;
  const status = body?.status === "RANKED" || body?.status === "UNRANKED" || body?.status === "LEGACY" ? body.status : undefined;
  try {
    return NextResponse.json({ success: true, status: status ?? "ALL", ...(await syncAndAutoReviewRhythiaMaps(status)) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Rhythia map synchronization failed." }, { status: 500 });
  }
}
