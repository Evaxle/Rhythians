import { NextResponse } from "next/server";
import { getSessionUser, isOwner } from "@/lib/auth";
import { moderateClip } from "@/lib/moderation";

type Props = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Props) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!isOwner(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    status?: unknown;
    rejectionReason?: unknown;
  } | null;

  const result = await moderateClip(
    user.id,
    id,
    body?.status as "approved" | "rejected",
    typeof body?.rejectionReason === "string" ? body.rejectionReason : null
  );

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ clip: result.clip });
}
