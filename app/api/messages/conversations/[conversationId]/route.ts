import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

const PUBLIC_USER_FIELDS = {
  id: true,
  discordId: true,
  username: true,
  discriminator: true,
  avatar: true,
  displayName: true,
  profileHandle: true,
} as const;

type Props = { params: Promise<{ conversationId: string }> };

export async function GET(_request: Request, { params }: Props) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { conversationId } = await params;

  const membership = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: { conversationId, userId: user.id },
    },
  });

  if (!membership) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      members: {
        include: { user: { select: PUBLIC_USER_FIELDS } },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 100,
      },
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const members = conversation.members.map((m) => ({
    id: m.user.id,
    discordId: m.user.discordId,
    username: m.user.username,
    discriminator: m.user.discriminator,
    avatar: m.user.avatar,
    displayName: m.user.displayName,
    profileHandle: m.user.profileHandle,
    role: m.role,
    joinedAt: m.joinedAt.toISOString(),
  }));

  return NextResponse.json({
    conversation: {
      id: conversation.id,
      type: conversation.type,
      name: conversation.name,
      createdById: conversation.createdById,
      members,
      messages: conversation.messages.map((message) => ({
        id: message.id,
        content: message.content,
        senderId: message.senderId,
        createdAt: message.createdAt.toISOString(),
        isEdited: message.isEdited,
        isDeleted: message.isDeleted,
      })),
    },
  });
}
