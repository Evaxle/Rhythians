import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await canAccessAdmin(sessionUser))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: userId } = await params;
  const { tagIds } = await request.json();

  if (!Array.isArray(tagIds)) {
    return NextResponse.json({ error: "tagIds must be an array" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const tags = await prisma.tag.findMany({
    where: { id: { in: tagIds } },
  });

  if (tags.length !== tagIds.length) {
    return NextResponse.json({ error: "Some tags not found" }, { status: 400 });
  }

  await prisma.userTag.deleteMany({
    where: { userId },
  });

  if (tagIds.length > 0) {
    await prisma.userTag.createMany({
      data: tagIds.map((tagId: string) => ({ userId, tagId, source: "manual" })),
    });
  }

  const updatedUser = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userTags: {
        include: { tag: true },
      },
    },
  });

  return NextResponse.json({ user: updatedUser });
}
