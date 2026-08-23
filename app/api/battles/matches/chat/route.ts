import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const matchId = new URL(request.url).searchParams.get("matchId");
  if (!matchId) return NextResponse.json({ error: "Match required." }, { status: 400 });
  const players = await prisma.$queryRawUnsafe<Array<{ userId: string }>>('SELECT "userId" FROM "BattleMatchPlayer" WHERE "matchId" = $1', matchId);
  if (!players.some((player) => player.userId === user.id)) return NextResponse.json({ error: "You are not part of this battle." }, { status: 403 });
  const memberIds = players.map((player) => player.userId);
  const name = `battle:${matchId}`;
  let conversation = await prisma.conversation.findFirst({ where: { type: "group", name }, select: { id: true } });
  if (!conversation) {
    conversation = await prisma.conversation.create({ data: { type: "group", name, createdById: user.id, members: { create: memberIds.map((userId) => ({ userId })) } }, select: { id: true } });
  } else {
    const existing = await prisma.conversationMember.findMany({ where: { conversationId: conversation.id }, select: { userId: true } });
    const missing = memberIds.filter((userId) => !existing.some((member) => member.userId === userId));
    if (missing.length) await prisma.conversationMember.createMany({ data: missing.map((userId) => ({ conversationId: conversation!.id, userId })) });
  }
  return NextResponse.json({ conversationId: conversation.id });
}
