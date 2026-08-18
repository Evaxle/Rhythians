import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

type Props = { params: Promise<{ conversationId: string; messageId: string }> };

export async function DELETE(_request: Request, { params }: Props) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { conversationId, messageId } = await params;

  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: user.id } },
  });
  if (!membership) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const message = await prisma.message.findFirst({
    where: { id: messageId, conversationId },
    include: { conversation: { select: { type: true } } },
  });
  if (!message) {
    return NextResponse.json({ error: "Message not found." }, { status: 404 });
  }

  const isAuthor = message.senderId === user.id;
  const isGroupOwner = message.conversation.type === "group" && membership.role === "owner";

  if (!isAuthor && !isGroupOwner) {
    return NextResponse.json({ error: "You can only delete your own messages." }, { status: 403 });
  }

  await prisma.message.update({
    where: { id: messageId },
    data: { isDeleted: true, isEdited: false },
  });

  return NextResponse.json({ ok: true });
}
