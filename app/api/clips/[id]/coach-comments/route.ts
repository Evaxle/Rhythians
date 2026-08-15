import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { censorProfanity } from "@/lib/profanity";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: clipId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    include: {
      userTags: {
        include: { tag: true },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const isCoach = user.userTags.some((ut) => ut.tag.slug === "rhythian-coach");

  if (!isCoach) {
    return NextResponse.json({ error: "Only Rhythian Coaches can post comments here" }, { status: 403 });
  }

  const { text } = await request.json();

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: "Comment text is required" }, { status: 400 });
  }

  if (text.length > 2000) {
    return NextResponse.json({ error: "Comment must be 2000 characters or less" }, { status: 400 });
  }

  const clip = await prisma.clip.findUnique({
    where: { id: clipId },
  });

  if (!clip) {
    return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }

  const comment = await prisma.coachComment.create({
    data: {
      text: censorProfanity(text.trim()).filtered,
      clipId,
      authorId: user.id,
    },
    include: {
      author: {
        include: {
          userTags: {
            include: { tag: true },
          },
        },
      },
    },
  });

  return NextResponse.json({ comment }, { status: 201 });
}
