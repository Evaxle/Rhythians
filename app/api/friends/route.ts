import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { PUBLIC_USER_FIELDS } from "@/lib/friends";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const [sentRequests, receivedRequests] = await Promise.all([
    prisma.friendRequest.findMany({
      where: { senderId: user.id, status: { in: ["pending", "accepted"] } },
      include: { receiver: { select: PUBLIC_USER_FIELDS } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.friendRequest.findMany({
      where: { receiverId: user.id, status: { in: ["pending", "accepted"] } },
      include: { sender: { select: PUBLIC_USER_FIELDS } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const acceptedIds = new Set(
    [...sentRequests, ...receivedRequests]
      .filter((r) => r.status === "accepted")
      .map((r) => (r.senderId === user.id ? r.receiverId : r.senderId)),
  );

  const friends = new Map<string, typeof PUBLIC_USER_FIELDS & Record<string, unknown>>();
  for (const request of sentRequests) {
    if (request.status === "accepted") friends.set(request.receiverId, request.receiver as never);
  }
  for (const request of receivedRequests) {
    if (request.status === "accepted") friends.set(request.senderId, request.sender as never);
  }

  return NextResponse.json({
    friends: [...friends.values()],
    incoming: receivedRequests
      .filter((r) => r.status === "pending")
      .map((r) => ({
        id: r.id,
        user: r.sender,
        createdAt: r.createdAt.toISOString(),
      })),
    outgoing: sentRequests
      .filter((r) => r.status === "pending")
      .map((r) => ({
        id: r.id,
        user: r.receiver,
        createdAt: r.createdAt.toISOString(),
      })),
    friendCount: acceptedIds.size,
  });
}
