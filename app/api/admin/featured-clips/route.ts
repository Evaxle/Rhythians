import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, isOwner } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!isOwner(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    primaryId?: unknown;
    secondaryId?: unknown;
  } | null;

  const primaryId = typeof body?.primaryId === "string" ? body.primaryId : null;
  const secondaryId = typeof body?.secondaryId === "string" ? body.secondaryId : null;

  const clipIds = [primaryId, secondaryId].filter((id): id is string => Boolean(id));
  const uniqueIds = new Set(clipIds);
  if (uniqueIds.size !== clipIds.length) {
    return NextResponse.json({ error: "The two featured clips must be different." }, { status: 400 });
  }

  const clips = clipIds.length
    ? await prisma.clip.findMany({ where: { id: { in: clipIds } }, select: { id: true, status: true } })
    : [];

  for (const id of clipIds) {
    const clip = clips.find((item) => item.id === id);
    if (!clip || clip.status !== "approved") {
      return NextResponse.json({ error: "Every featured clip must exist and be approved." }, { status: 400 });
    }
  }

  await prisma.$transaction([
    prisma.clip.updateMany({ data: { featuredOrder: null }, where: { featuredOrder: { not: null } } }),
    ...(primaryId ? [prisma.clip.update({ where: { id: primaryId }, data: { featuredOrder: 1 } })] : []),
    ...(secondaryId ? [prisma.clip.update({ where: { id: secondaryId }, data: { featuredOrder: 2 } })] : []),
  ]);

  return NextResponse.json({ ok: true });
}
