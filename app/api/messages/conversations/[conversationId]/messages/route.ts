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

  const body = await request.json().catch(() => null) as { content?: unknown } | null;
  const content = typeof body?.content === "string" ? body.content.trim() : "";

  if (!content || content.length > 4000) {
    return NextResponse.json({ error: "Message must be between 1 and 4000 characters." }, { status: 400 });
  }

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId: user.id,
      content,
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  const otherMembers = await prisma.conversationMember.findMany({
    where: { conversationId, userId: { not: user.id } },
    select: { userId: true },
  });

  if (otherMembers.length > 0) {
    await prisma.notification.createMany({
      data: otherMembers.map((member) => ({
        userId: member.userId,
        type: "new_message",
        title: "New message",
        message: content.slice(0, 120),
        url: `/messages?conversation=${conversationId}`,
      })),
    });
  }

  return NextResponse.json(
    {
      message: {
        id: message.id,
        content: message.content,
        senderId: message.senderId,
        createdAt: message.createdAt.toISOString(),
        isEdited: message.isEdited,
      },
    },
    { status: 201 },
  );
}

export async function GET(request: Request, { params }: Props) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { conversationId } = await params;
  const url = new URL(request.url);
  const beforeRaw = url.searchParams.get("before");

  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: user.id } },
  });
  if (!membership) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      isDeleted: false,
      ...(beforeRaw ? { createdAt: { lt: new Date(beforeRaw) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    messages: messages.reverse().map((message) => ({
      id: message.id,
      content: message.content,
      senderId: message.senderId,
      createdAt: message.createdAt.toISOString(),
      isEdited: message.isEdited,
    })),
  });
}
