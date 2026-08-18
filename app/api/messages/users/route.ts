import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const excludeConversation = url.searchParams.get("excludeConversation");

  let users;
  if (query.length === 0) {
    users = await prisma.user.findMany({
      where: { id: { not: user.id } },
      take: 20,
      orderBy: { username: "asc" },
      select: {
        id: true,
        username: true,
        discriminator: true,
        avatar: true,
        displayName: true,
        profileHandle: true,
      },
    });
  } else {
    users = await prisma.user.findMany({
      where: {
        id: { not: user.id },
        OR: [
          { username: { contains: query, mode: "insensitive" } },
          { displayName: { contains: query, mode: "insensitive" } },
          { profileHandle: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 20,
      select: {
        id: true,
        username: true,
        discriminator: true,
        avatar: true,
        displayName: true,
        profileHandle: true,
      },
    });
  }

  if (excludeConversation) {
    const existingMembers = await prisma.conversationMember.findMany({
      where: { conversationId: excludeConversation },
      select: { userId: true },
    });
    const existingIds = new Set(existingMembers.map((m) => m.userId));
    existingIds.add(user.id);
    users = users.filter((u) => !existingIds.has(u.id));
  }

  return NextResponse.json({ users });
}
