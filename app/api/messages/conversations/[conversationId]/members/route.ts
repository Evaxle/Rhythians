import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

type Props = { params: Promise<{ conversationId: string }> };

export async function POST(request: Request, { params }: Props) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { conversationId } = await params;

  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: user.id } },
  });
  if (!membership) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { type: true },
  });
  if (conversation?.type !== "group") {
    return NextResponse.json({ error: "Only group conversations can add members." }, { status: 400 });
  }

  if (membership.role !== "owner") {
    return NextResponse.json({ error: "Only the group owner can add members." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { userIds?: unknown } | null;
  const userIds = Array.isArray(body?.userIds) ? body.userIds.filter((id): id is string => typeof id === "string") : [];

  if (userIds.length === 0) {
    return NextResponse.json({ error: "Select at least one user to add." }, { status: 400 });
  }

  const validCount = await prisma.user.count({ where: { id: { in: userIds } } });
  if (validCount !== userIds.length) {
    return NextResponse.json({ error: "One or more selected users do not exist." }, { status: 400 });
  }

  const existing = await prisma.conversationMember.findMany({
    where: { conversationId, userId: { in: userIds } },
    select: { userId: true },
  });
  const existingIds = new Set(existing.map((m) => m.userId));
  const toAdd = userIds.filter((id) => !existingIds.has(id));

  if (toAdd.length > 0) {
    await prisma.conversationMember.createMany({
      data: toAdd.map((userId) => ({ conversationId, userId, role: "member" })),
      skipDuplicates: true,
    });
  }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ added: toAdd.length }, { status: 201 });
}
