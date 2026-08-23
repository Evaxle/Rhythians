import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

type Props = { params: Promise<{ conversationId: string }> };

export async function POST(request: Request, { params }: Props) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { conversationId } = await params;
  const member = await prisma.conversationMember.findUnique({ where: { conversationId_userId: { conversationId, userId: user.id } } });
  if (!member) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  const body = await request.json().catch(() => null) as { typing?: unknown } | null;
  const typing = body?.typing === true;
  if (typing) {
    await prisma.$executeRawUnsafe(`INSERT INTO "MessageTyping" ("id", "conversationId", "userId", "expiresAt", "updatedAt") VALUES (gen_random_uuid()::text, $1, $2, NOW() + INTERVAL '4 seconds', NOW()) ON CONFLICT ("conversationId", "userId") DO UPDATE SET "expiresAt" = NOW() + INTERVAL '4 seconds', "updatedAt" = NOW()`, conversationId, user.id);
  } else {
    await prisma.$executeRawUnsafe(`DELETE FROM "MessageTyping" WHERE "conversationId" = $1 AND "userId" = $2`, conversationId, user.id);
  }
  return NextResponse.json({ ok: true });
}
