import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { censorProfanity } from "@/lib/profanity";

type Props = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Props) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id: clipId } = await params;
  const body = await request.json().catch(() => null) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";

  if (!text || text.length > 2000) {
    return NextResponse.json({ error: "Comment must be between 1 and 2000 characters." }, { status: 400 });
  }

  const filtered = censorProfanity(text).filtered;

  const clip = await prisma.clip.findUnique({ where: { id: clipId }, select: { status: true } });
  if (!clip || clip.status !== "approved") {
    return NextResponse.json({ error: "Clip not found." }, { status: 404 });
  }

  const comment = await prisma.comment.create({
    data: { text: filtered, clipId, authorId: user.id },
    include: {
      author: {
        select: {
          username: true,
          discriminator: true,
          userTags: {
            include: { tag: true },
          },
        },
      },
    },
  });

  return NextResponse.json({
    comment: {
      id: comment.id,
      text: comment.text,
      createdAt: comment.createdAt.toISOString(),
      author: {
        username: comment.author.username,
        discriminator: comment.author.discriminator,
        userTags: comment.author.userTags.map((ut) => ({
          tag: { name: ut.tag.name, slug: ut.tag.slug },
        })),
      },
    },
  }, { status: 201 });
}
