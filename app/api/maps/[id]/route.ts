import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canReviewMaps } from "@/lib/map-review";
import { reviewChallengeMap } from "@/lib/maps";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  if (!(await canReviewMaps(user))) {
    return NextResponse.json({ error: "You are not a map reviewer." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const status = body?.status as "approved" | "rejected" | undefined;
  if (status !== "approved" && status !== "rejected") {
    return NextResponse.json({ error: "Invalid review status." }, { status: 400 });
  }

  let finalRating: number | null = null;
  if (status === "approved") {
    const raw = Number(body?.finalRating ?? body?.rating);
    if (Number.isFinite(raw) && raw >= 0 && raw <= 9.99) {
      finalRating = raw;
    }
  }

  const note = typeof body?.note === "string" ? body.note : null;

  try {
    const updated = await reviewChallengeMap(id, user.id, status, finalRating, note);
    return NextResponse.json({ map: updated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to review this map." }, { status: 400 });
  }
}