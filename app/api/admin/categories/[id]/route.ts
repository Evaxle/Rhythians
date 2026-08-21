import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { CATEGORY_LABELS, isCategory, MAX_CATEGORY_LEVEL, type Category } from "@/lib/categories";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Props) {
  const admin = await getSessionUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canAccessAdmin(admin))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  const map = await prisma.categoryMap.findUnique({ where: { id } });
  if (!map) return NextResponse.json({ error: "Map not found." }, { status: 404 });

  const data: { status?: "approved" | "rejected" | "hidden"; level?: number; category?: Category; reviewerNote?: string | null; reviewedById?: string; reviewedAt?: Date } = {};

  if (body?.status === "approved" || body?.status === "rejected" || body?.status === "hidden") {
    data.status = body.status;
    data.reviewedById = admin.id;
    data.reviewedAt = new Date();
  }

  if (body?.level !== undefined) {
    const level = Number(body.level);
    if (!Number.isInteger(level) || level < 1 || level > MAX_CATEGORY_LEVEL) {
      return NextResponse.json({ error: `Level must be between 1 and ${MAX_CATEGORY_LEVEL}.` }, { status: 400 });
    }
    data.level = level;
  }

  if (body?.category !== undefined) {
    if (typeof body.category !== "string" || !isCategory(body.category)) return NextResponse.json({ error: "Invalid category." }, { status: 400 });
    data.category = body.category;
  }

  if (typeof body?.reviewerNote === "string") {
    data.reviewerNote = body.reviewerNote.trim().slice(0, 1000) || null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const updated = await prisma.categoryMap.update({ where: { id }, data });

  if (data.status === "approved") {
    await prisma.notification.create({
      data: {
        userId: map.submittedById,
        type: "map_approved",
        title: "Category map approved",
        message: `"${map.title}" was approved for ${CATEGORY_LABELS[map.category]} level ${map.level}.`,
        url: "/categories",
      },
    });
  } else if (data.status === "rejected") {
    await prisma.notification.create({
      data: {
        userId: map.submittedById,
        type: "map_rejected",
        title: "Category map rejected",
        message: `"${map.title}" was rejected.${data.reviewerNote ? `\n\nReason: ${data.reviewerNote}` : ""}`,
        url: "/categories",
      },
    });
  }

  return NextResponse.json({ map: updated });
}
