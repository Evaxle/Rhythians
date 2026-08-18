import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";

type Props = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Props) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!(await canAccessAdmin(user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const map = await prisma.challengeMap.findUnique({
    where: { id },
    include: {
      submittedBy: { select: { id: true, username: true, displayName: true, profileHandle: true, avatar: true } },
      reviewedBy: { select: { id: true, username: true, displayName: true, profileHandle: true, avatar: true } },
      completions: {
        include: { user: { select: { id: true, username: true, displayName: true, profileHandle: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!map) return NextResponse.json({ error: "Map not found." }, { status: 404 });

  return NextResponse.json({
    map: {
      ...map,
      createdAt: map.createdAt.toISOString(),
      updatedAt: map.updatedAt.toISOString(),
      reviewedAt: map.reviewedAt?.toISOString() ?? null,
    },
  });
}

export async function PATCH(request: Request, { params }: Props) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!(await canAccessAdmin(user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    rating?: unknown;
    status?: unknown;
    mapperName?: unknown;
    artist?: unknown;
    title?: unknown;
  } | null;

  const map = await prisma.challengeMap.findUnique({ where: { id }, select: { id: true } });
  if (!map) return NextResponse.json({ error: "Map not found." }, { status: 404 });

  const data: Record<string, unknown> = {};

  if (typeof body?.rating === "number" && Number.isFinite(body.rating) && body.rating >= 0 && body.rating <= 9.99) {
    data.rating = Math.round(body.rating * 100) / 100;
  }
  if (typeof body?.title === "string" && body.title.trim()) data.title = body.title.trim();
  if (typeof body?.artist === "string") data.artist = body.artist.trim() || null;
  if (typeof body?.mapperName === "string") data.mapperName = body.mapperName.trim() || null;
  if (typeof body?.status === "string" && ["pending", "approved", "rejected", "hidden"].includes(body.status)) {
    data.status = body.status;
  }

  const updated = await prisma.challengeMap.update({ where: { id }, data });
  return NextResponse.json({ map: updated });
}

export async function DELETE(_request: Request, { params }: Props) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!(await canAccessAdmin(user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const map = await prisma.challengeMap.findUnique({ where: { id }, select: { id: true, title: true } });
  if (!map) return NextResponse.json({ error: "Map not found." }, { status: 404 });

  await prisma.challengeMap.delete({ where: { id } });

  await prisma.moderationAction.create({
    data: {
      actorId: user.id,
      action: "challenge_map_deleted",
      targetType: "challenge_map",
      targetId: id,
      metadata: { title: map.title },
    },
  });

  return NextResponse.json({ ok: true });
}