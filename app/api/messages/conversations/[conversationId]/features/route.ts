import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

type Props = { params: Promise<{ conversationId: string }> };

export async function GET(_request: Request, { params }: Props) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { conversationId } = await params;
  const member = await prisma.conversationMember.findUnique({ where: { conversationId_userId: { conversationId, userId: user.id } } });
  if (!member) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  const reactions = await prisma.$queryRawUnsafe<Array<{ messageId: string; emoji: string; userId: string; count: bigint }>>(`SELECT "messageId", "emoji", "userId", COUNT(*) OVER (PARTITION BY "messageId", "emoji") AS "count" FROM "MessageReaction" WHERE "messageId" IN (SELECT "id" FROM "Message" WHERE "conversationId" = $1)`, conversationId);
  const replies = await prisma.$queryRawUnsafe<Array<{ messageId: string; repliedToId: string }>>(`SELECT "messageId", "repliedToId" FROM "MessageReply" WHERE "messageId" IN (SELECT "id" FROM "Message" WHERE "conversationId" = $1)`, conversationId);
  const typing = await prisma.$queryRawUnsafe<Array<{ userId: string; username: string }>>(`SELECT mt."userId", u."username" FROM "MessageTyping" mt JOIN "User" u ON u."id" = mt."userId" WHERE mt."conversationId" = $1 AND mt."expiresAt" > NOW() AND mt."userId" <> $2`, conversationId, user.id);
  const grouped = new Map<string, Array<{ emoji: string; count: number; reacted: boolean }>>();
  for (const row of reactions) {
    const list = grouped.get(row.messageId) ?? [];
    const existing = list.find((item) => item.emoji === row.emoji);
    if (existing) existing.reacted ||= row.userId === user.id;
    else list.push({ emoji: row.emoji, count: Number(row.count), reacted: row.userId === user.id });
    grouped.set(row.messageId, list);
  }
  return NextResponse.json({ reactions: Object.fromEntries(grouped), replies, typing: typing.map((item) => ({ userId: item.userId, username: item.username })) });
}
