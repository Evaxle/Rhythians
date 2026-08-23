import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

type Props = { params: Promise<{ conversationId: string; messageId: string }> };

export async function POST(request: Request, { params }: Props) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { conversationId, messageId } = await params;
  const member = await prisma.conversationMember.findUnique({ where: { conversationId_userId: { conversationId, userId: user.id } } });
  if (!member) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  const message = await prisma.message.findFirst({ where: { id: messageId, conversationId }, select: { id: true } });
  if (!message) return NextResponse.json({ error: "Message not found." }, { status: 404 });
  const body = await request.json().catch(() => null) as { emoji?: unknown } | null;
  const emoji = typeof body?.emoji === "string" ? body.emoji.trim() : "";
  if (!emoji || emoji.length > 16) return NextResponse.json({ error: "Invalid reaction." }, { status: 400 });
  const existing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id" FROM "MessageReaction" WHERE "messageId" = $1 AND "userId" = $2 AND "emoji" = $3 LIMIT 1`, messageId, user.id, emoji);
  if (existing[0]) await prisma.$executeRawUnsafe(`DELETE FROM "MessageReaction" WHERE "id" = $1`, existing[0].id);
  else await prisma.$executeRawUnsafe(`INSERT INTO "MessageReaction" ("id", "messageId", "userId", "emoji") VALUES (gen_random_uuid()::text, $1, $2, $3)`, messageId, user.id, emoji);
  return NextResponse.json({ ok: true, active: !existing[0] });
}
