import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canSendMessageToConversation } from "@/lib/friends";
import { censorProfanity } from "@/lib/profanity";
import { isCurrentlyMuted } from "@/lib/user-moderation";

type Props = { params: Promise<{ conversationId: string; messageId: string }> };

export async function POST(request: Request, { params }: Props) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (isCurrentlyMuted(user)) return NextResponse.json({ error: "You are muted and cannot send messages." }, { status: 403 });
  const { conversationId, messageId } = await params;
  const member = await prisma.conversationMember.findUnique({ where: { conversationId_userId: { conversationId, userId: user.id } } });
  if (!member) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  const gate = await canSendMessageToConversation(user.id, conversationId);
  if (!gate.allowed) return NextResponse.json({ error: gate.reason }, { status: 403 });
  const parent = await prisma.message.findFirst({ where: { id: messageId, conversationId }, select: { id: true } });
  if (!parent) return NextResponse.json({ error: "Message not found." }, { status: 404 });
  const body = await request.json().catch(() => null) as { content?: unknown } | null;
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!content || content.length > 4000) return NextResponse.json({ error: "Message must be between 1 and 4000 characters." }, { status: 400 });
  const message = await prisma.message.create({ data: { conversationId, senderId: user.id, content: censorProfanity(content).filtered } });
  await prisma.$executeRawUnsafe(`INSERT INTO "MessageReply" ("id", "messageId", "repliedToId") VALUES (gen_random_uuid()::text, $1, $2)`, message.id, messageId);
  await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
  return NextResponse.json({ message: { id: message.id, content: message.content, senderId: message.senderId, createdAt: message.createdAt.toISOString(), isEdited: message.isEdited, isDeleted: message.isDeleted }, replyToId: messageId }, { status: 201 });
}
