import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, isOwner } from "@/lib/auth";

type Props = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Props) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!isOwner(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null) as { status?: unknown; rejectionReason?: unknown } | null;
  const status = body?.status;
  if (status !== "approved" && status !== "rejected") {
    return NextResponse.json({ error: "Status must be approved or rejected." }, { status: 400 });
  }

  const clip = await prisma.clip.findUnique({ where: { id }, select: { id: true, title: true, status: true } });
  if (!clip) return NextResponse.json({ error: "Clip not found." }, { status: 404 });

  const rejectionReason = typeof body?.rejectionReason === "string" ? body.rejectionReason.trim().slice(0, 500) : null;
  const updated = await prisma.clip.update({
    where: { id },
    data: {
      status,
      rejectionReason: status === "rejected" ? rejectionReason : null,
    },
    select: { id: true, status: true, rejectionReason: true },
  });

  await prisma.moderationAction.create({
    data: {
      actorId: user.id,
      action: status === "approved" ? "clip_approved" : "clip_rejected",
      targetType: "clip",
      targetId: clip.id,
      metadata: { title: clip.title, previousStatus: clip.status, rejectionReason },
    },
  });

  return NextResponse.json({ clip: updated });
}
