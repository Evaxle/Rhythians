import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

type Props = { params: Promise<{ conversationId: string; userId: string }> };

export async function DELETE(_request: Request, { params }: Props) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { conversationId, userId } = await params;

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
    return NextResponse.json({ error: "You can only remove members from group conversations." }, { status: 400 });
  }

  const isSelf = userId === user.id;

  if (!isSelf && membership.role !== "owner") {
    return NextResponse.json({ error: "Only the group owner can remove members." }, { status: 403 });
  }

  if (isSelf && membership.role === "owner") {
    const otherOwners = await prisma.conversationMember.count({
      where: { conversationId, role: "owner", userId: { not: user.id } },
    });
    const memberCount = await prisma.conversationMember.count({ where: { conversationId } });
    if (otherOwners === 0 && memberCount > 1) {
      return NextResponse.json({ error: "Transfer ownership before leaving the group." }, { status: 400 });
    }
  }

  await prisma.conversationMember.deleteMany({
    where: { conversationId, userId },
  });

  const remaining = await prisma.conversationMember.count({ where: { conversationId } });
  if (remaining === 0) {
    await prisma.conversation.delete({ where: { id: conversationId } });
  }

  return NextResponse.json({ ok: true });
}
