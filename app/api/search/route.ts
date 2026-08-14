import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PUBLIC_USER_FIELDS } from "@/lib/friends";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";

  if (!q) {
    return NextResponse.json({ users: [], articles: [], clips: [], announcements: [], rules: [] });
  }

  const [users, articles, clips, announcements, rules] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: q, mode: "insensitive" } },
          { displayName: { contains: q, mode: "insensitive" } },
          { profileHandle: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 10,
      select: PUBLIC_USER_FIELDS,
    }),
    prisma.knowledgeArticle.findMany({
      where: {
        published: true,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 10,
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        category: { select: { slug: true, name: true } },
      },
    }),
    prisma.clip.findMany({
      where: {
        status: "approved",
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 10,
      select: {
        id: true,
        title: true,
        description: true,
        category: { select: { name: true } },
      },
    }),
    prisma.announcement.findMany({
      where: {
        published: true,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { content: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 10,
      select: { id: true, title: true, slug: true, createdAt: true },
    }),
    prisma.rule.findMany({
      where: {
        enabled: true,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { content: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 10,
      select: { id: true, title: true, slug: true },
    }),
  ]);

  return NextResponse.json({ users, articles, clips, announcements, rules });
}
