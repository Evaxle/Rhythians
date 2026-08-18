import { prisma } from "@/lib/db";

export type FriendStatus = "friends" | "outgoing_pending" | "incoming_pending" | "none";

export async function getFriendStatus(userId: string, otherUserId: string): Promise<FriendStatus> {
  const requests = await prisma.friendRequest.findMany({
    where: {
      OR: [
        { senderId: userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: userId },
      ],
    },
  });

  const accepted = requests.find((r) => r.status === "accepted");
  if (accepted) return "friends";

  const pending = requests.find((r) => r.status === "pending");
  if (pending) {
    return pending.senderId === userId ? "outgoing_pending" : "incoming_pending";
  }

  return "none";
}

export async function canSendMessageToConversation(userId: string, conversationId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { members: { select: { userId: true } } },
  });
  if (!conversation) return { allowed: false, reason: "Conversation not found." };
  if (conversation.type === "group") return { allowed: true, reason: null };

  const other = conversation.members.find((m) => m.userId !== userId);
  if (!other) return { allowed: false, reason: "Conversation not found." };

  const status = await getFriendStatus(userId, other.userId);
  if (status === "friends" || status === "incoming_pending") {
    return { allowed: true, reason: null };
  }

  const sentCount = await prisma.message.count({
    where: { conversationId, senderId: userId, isDeleted: false },
  });
  if (sentCount >= 1) {
    return {
      allowed: false,
      reason: "This user hasn't added you back yet. You can send one message before they accept your friend request.",
    };
  }
  return { allowed: true, reason: null };
}

export const PUBLIC_USER_FIELDS = {
  id: true,
  discordId: true,
  username: true,
  discriminator: true,
  avatar: true,
  displayName: true,
  profileHandle: true,
} as const;
