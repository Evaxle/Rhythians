"use client";

export type UserLite = {
  id: string;
  discordId: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  displayName: string | null;
  profileHandle: string;
};

export type ConversationSummary = {
  id: string;
  type: "direct" | "group";
  name: string | null;
  avatar: string | null;
  otherUsers: UserLite[];
  memberIds: string[];
  lastMessage: {
    id: string;
    content: string;
    senderId: string;
    createdAt: string;
    isDeleted: boolean;
  } | null;
  unreadCount: number;
  updatedAt: string;
};

export type MessageItem = {
  id: string;
  content: string;
  senderId: string;
  createdAt: string;
  isEdited: boolean;
  isDeleted: boolean;
};

export type ConversationMember = UserLite & { role: string; joinedAt: string };

export type ConversationDetail = {
  id: string;
  type: "direct" | "group";
  name: string | null;
  createdById: string | null;
  members: ConversationMember[];
  messages: MessageItem[];
};

export function userDisplayName(user: Pick<UserLite, "displayName" | "username">) {
  return user.displayName ?? user.username;
}

export function userAvatarUrl(user: Pick<UserLite, "avatar" | "discordId" | "username"> & { discordId?: string }) {
  if (user.avatar && user.discordId) {
    return `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=64`;
  }
  return null;
}

export function getAvatarInitial(user: Pick<UserLite, "username">) {
  return user.username.slice(0, 1).toUpperCase();
}
