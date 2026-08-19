import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, isOwner } from "@/lib/auth";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Props) {
  const admin = await getSessionUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOwner(admin)) return NextResponse.json({ error: "Only the site owner can change profile titles." }, { status: 403 });
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { title?: unknown; color?: unknown } | null;
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 40) : "";
  const color = typeof body?.color === "string" ? body.color.trim() : "#a78bfa";
  if (color !== "" && !/^#[0-9a-fA-F]{6}$/.test(color)) return NextResponse.json({ error: "Title color must be a 6-digit hex color." }, { status: 400 });

  if (!title) {
    await prisma.$executeRawUnsafe('DELETE FROM "UserProfileTitle" WHERE "userId" = $1', id);
    return NextResponse.json({ title: "", color: "#a78bfa" });
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO "UserProfileTitle" ("id", "userId", "title", "color", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("userId") DO UPDATE SET "title" = EXCLUDED."title", "color" = EXCLUDED."color", "updatedAt" = CURRENT_TIMESTAMP`,
    randomUUID(), id, title, color,
  );
  await prisma.moderationAction.create({ data: { actorId: admin.id, action: "profile_title_edited", targetType: "user", targetId: id, metadata: { title, color } } });
  return NextResponse.json({ title, color });
}
