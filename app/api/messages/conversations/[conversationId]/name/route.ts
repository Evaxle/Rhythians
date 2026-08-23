import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { conversationId } = await params;
  const body = await request.json().catch(() => null) as { name?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 60) return NextResponse.json({ error: "Group name must be between 1 and 60 characters." }, { status: 400 });
  const conversation = await prisma.conversation.findFirst({ where: { id: conversationId, type: "group", members: { some: { userId: user.id } } }, include: { members: true } });
  if (!conversation) return NextResponse.json({ error: "Group not found." }, { status: 404 });
  const member = conversation.members.find((item) => item.userId === user.id);
  if (!member || (member.role !== "owner" && member.role !== "admin")) return NextResponse.json({ error: "Only group owners and admins can rename this group." }, { status: 403 });
  const updated = await prisma.conversation.update({ where: { id: conversationId }, data: { name } });
  return NextResponse.json({ ok: true, name: updated.name });
}
