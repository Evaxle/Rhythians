import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { moderateClip } from "@/lib/moderation";

type Props = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Props) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!(await canAccessAdmin(user))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const clip = await prisma.clip.findUnique({
    where: { id },
    include: {
      uploader: { select: { id: true, username: true, discriminator: true, displayName: true } },
      reviewedBy: { select: { id: true, username: true, discriminator: true, displayName: true } },
      category: { select: { name: true } },
      tags: { select: { tag: { select: { name: true, slug: true } } } },
      _count: { select: { likes: true, views: true, comments: true, coachComments: true } },
    },
  });

  if (!clip) {
    return NextResponse.json({ error: "Clip not found." }, { status: 404 });
  }

  return NextResponse.json({
    clip: {
      ...clip,
      createdAt: clip.createdAt.toISOString(),
      updatedAt: clip.updatedAt.toISOString(),
      reviewedAt: clip.reviewedAt?.toISOString() ?? null,
    },
  });
}

export async function DELETE(_request: Request, { params }: Props) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!(await canAccessAdmin(user))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const clip = await prisma.clip.findUnique({
    where: { id },
    select: { id: true, title: true, status: true, uploaderId: true, storagePath: true, thumbnailPath: true },
  });
  if (!clip) return NextResponse.json({ error: "Clip not found." }, { status: 404 });
  if (clip.status === "deleted") {
    return NextResponse.json({ error: "Clip is already deleted." }, { status: 400 });
  }

  const updated = await prisma.clip.update({
    where: { id: clip.id },
    data: { status: "deleted" },
    select: { id: true, status: true },
  });

  await prisma.moderationAction.create({
    data: {
      actorId: user.id,
      action: "clip_deleted",
      targetType: "clip",
      targetId: clip.id,
      metadata: {
        title: clip.title,
        previousStatus: clip.status,
      },
    },
  });

  if (supabaseAdmin) {
    const paths = [clip.storagePath, ...(clip.thumbnailPath ? [clip.thumbnailPath] : [])];
    await supabaseAdmin.storage.from(process.env.STORAGE_BUCKET ?? "media").remove(paths);
  }

  return NextResponse.json({ clip: updated });
}

export async function PATCH(request: Request, { params }: Props) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!(await canAccessAdmin(user))) {
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
