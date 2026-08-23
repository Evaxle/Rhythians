import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getFriendStatus } from "@/lib/friends";
import { isCurrentlyMuted } from "@/lib/user-moderation";
import { getAvatarUrl } from "@/lib/avatar";

const PUBLIC_USER_FIELDS = { id: true, discordId: true, username: true, discriminator: true, avatar: true, displayName: true, profileHandle: true } as const;

function publicUser(user: { id: string; discordId: string | null; username: string; discriminator: string | null; avatar: string | null; displayName: string | null; profileHandle: string }) {
  return { ...user, avatar: getAvatarUrl(user, 128) };
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const memberships = await prisma.conversationMember.findMany({ where: { userId: user.id }, include: { conversation: { include: { members: { include: { user: { select: PUBLIC_USER_FIELDS } } }, messages: { orderBy: { createdAt: "desc" }, take: 1 } } } }, orderBy: { conversation: { updatedAt: "desc" } } });
  const conversations = await Promise.all(memberships.map(async (membership) => {
    const { conversation } = membership;
    const unread = await prisma.message.count({ where: { conversationId: conversation.id, senderId: { not: user.id }, isDeleted: false, createdAt: { gt: membership.lastReadAt ?? new Date(0) } } });
    const otherMembers = conversation.members.filter((member) => member.userId !== user.id).map((member) => publicUser(member.user));
    const members = conversation.members.map((member) => publicUser(member.user));
    const lastMessage = conversation.messages[0] ?? null;
    return {
      id: conversation.id,
      type: conversation.type,
      name: conversation.type === "group" ? conversation.name : otherMembers[0]?.username ?? "Chat",
      avatar: conversation.type === "group" ? null : otherMembers[0]?.avatar ?? null,
      otherUsers: conversation.type === "group" ? members : otherMembers,
      memberIds: conversation.members.map((member) => member.userId),
      lastMessage: lastMessage ? { id: lastMessage.id, content: lastMessage.content, senderId: lastMessage.senderId, createdAt: lastMessage.createdAt.toISOString(), isDeleted: lastMessage.isDeleted } : null,
      unreadCount: unread,
      updatedAt: conversation.updatedAt.toISOString(),
    };
  }));
  return NextResponse.json({ conversations });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (isCurrentlyMuted(user)) return NextResponse.json({ error: `You are muted and cannot start conversations until ${user.mutedUntil!.toLocaleString()}.` }, { status: 403 });
  const body = await request.json().catch(() => null) as { type?: unknown; userId?: unknown; name?: unknown; memberIds?: unknown } | null;
  const type = body?.type;
  if (type !== "direct" && type !== "group") return NextResponse.json({ error: "Invalid conversation type." }, { status: 400 });
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  if (type === "direct") {
    const otherUserId = typeof body.userId === "string" ? body.userId : "";
    if (!otherUserId) return NextResponse.json({ error: "A user is required for a direct conversation." }, { status: 400 });
    if (otherUserId === user.id) return NextResponse.json({ error: "You cannot message yourself." }, { status: 400 });
    const otherUser = await prisma.user.findUnique({ where: { id: otherUserId }, select: { id: true } });
    if (!otherUser) return NextResponse.json({ error: "User not found." }, { status: 404 });
    const friendStatus = await getFriendStatus(user.id, otherUserId);
    if (friendStatus === "none") return NextResponse.json({ error: "Add this user as a friend to start a conversation with them.", friendStatus }, { status: 403 });
    const existing = await prisma.conversation.findFirst({ where: { type: "direct", members: { every: { userId: { in: [user.id, otherUserId] } } } }, include: { members: true } });
    if (existing && existing.members.length === 2) return NextResponse.json({ conversationId: existing.id, friendStatus });
    const conversation = await prisma.conversation.create({ data: { type: "direct", createdById: user.id, members: { create: [{ userId: user.id, role: "member" }, { userId: otherUserId, role: "member" }] } } });
    return NextResponse.json({ conversationId: conversation.id, friendStatus }, { status: 201 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const memberIds = Array.isArray(body.memberIds) ? body.memberIds.filter((id): id is string => typeof id === "string" && id !== user.id) : [];
  if (!name) return NextResponse.json({ error: "A group name is required." }, { status: 400 });
  if (name.length > 60) return NextResponse.json({ error: "Group name must be 60 characters or fewer." }, { status: 400 });
  if (memberIds.length === 0) return NextResponse.json({ error: "Add at least one member to the group." }, { status: 400 });
  const validCount = await prisma.user.count({ where: { id: { in: memberIds } } });
  if (validCount !== memberIds.length) return NextResponse.json({ error: "One or more selected users do not exist." }, { status: 400 });
  const conversation = await prisma.conversation.create({ data: { type: "group", name, createdById: user.id, members: { create: [{ userId: user.id, role: "owner" }, ...memberIds.map((memberId) => ({ userId: memberId, role: "member" }))] } } });
  return NextResponse.json({ conversationId: conversation.id }, { status: 201 });
}
