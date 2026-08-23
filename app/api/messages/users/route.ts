import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getAvatarUrl } from "@/lib/avatar";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const excludeConversation = url.searchParams.get("excludeConversation");
  const select = { id: true, username: true, discriminator: true, avatar: true, discordId: true, displayName: true, profileHandle: true } as const;

  let users;
  if (query.length === 0) {
    users = await prisma.user.findMany({ where: { id: { not: user.id } }, take: 20, orderBy: { username: "asc" }, select });
  } else {
    users = await prisma.user.findMany({ where: { id: { not: user.id }, OR: [{ username: { contains: query, mode: "insensitive" } }, { displayName: { contains: query, mode: "insensitive" } }, { profileHandle: { contains: query, mode: "insensitive" } }] }, take: 20, select });
  }

  if (excludeConversation) {
    const existingMembers = await prisma.conversationMember.findMany({ where: { conversationId: excludeConversation }, select: { userId: true } });
    const existingIds = new Set(existingMembers.map((member) => member.userId));
    existingIds.add(user.id);
    users = users.filter((entry) => !existingIds.has(entry.id));
  }

  return NextResponse.json({ users: users.map((entry) => ({ ...entry, avatar: getAvatarUrl(entry, 128) })) });
}
