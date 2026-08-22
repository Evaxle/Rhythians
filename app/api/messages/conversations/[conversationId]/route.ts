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
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { conversationId } = await params;
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, members: { some: { userId: user.id } } },
    include: {
      members: { include: { user: { select: PUBLIC_USER_FIELDS } }, orderBy: { joinedAt: "asc" } },
      messages: { orderBy: { createdAt: "asc" }, take: 100 },
    },
  });

  if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

  const members = conversation.members.map((member) => ({
    id: member.user.id,
    discordId: member.user.discordId,
    username: member.user.username,
    discriminator: member.user.discriminator,
    avatar: member.user.avatar,
    displayName: member.user.displayName,
    profileHandle: member.user.profileHandle,
    role: member.role,
    joinedAt: member.joinedAt.toISOString(),
  }));
  const otherUsers = members.filter((member) => member.id !== user.id).map(({ role: _role, joinedAt: _joinedAt, ...publicUser }) => publicUser);

  return NextResponse.json({
    conversation: {
      id: conversation.id,
      type: conversation.type,
      name: conversation.name,
      createdById: conversation.createdById,
      members,
      otherUsers,
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
