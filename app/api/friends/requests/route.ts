import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { userId?: unknown } | null;
  const userId = typeof body?.userId === "string" ? body.userId : "";

  if (!userId) {
    return NextResponse.json({ error: "A user is required." }, { status: 400 });
  }
  if (userId === user.id) {
    return NextResponse.json({ error: "You cannot add yourself as a friend." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const existing = await prisma.friendRequest.findFirst({
    where: {
      OR: [
        { senderId: user.id, receiverId: userId },
        { senderId: userId, receiverId: user.id },
      ],
    },
  });

  if (existing) {
    if (existing.status === "accepted") {
      return NextResponse.json({ error: "You are already friends with this user." }, { status: 400 });
    }
    if (existing.senderId === userId) {
      // They already sent us a request - accept it as a mutual friendship.
      await prisma.friendRequest.update({
        where: { id: existing.id },
        data: { status: "accepted", respondedAt: new Date() },
      });
      return NextResponse.json({ status: "friends", created: false }, { status: 200 });
    }
    return NextResponse.json({ error: "Friend request already pending." }, { status: 400 });
  }

  await prisma.friendRequest.create({
    data: { senderId: user.id, receiverId: userId, status: "pending" },
  });

  return NextResponse.json({ status: "outgoing_pending", created: true }, { status: 201 });
}
