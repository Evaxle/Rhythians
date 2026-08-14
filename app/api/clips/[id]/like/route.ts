import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: clipId } = await params;

  const clip = await prisma.clip.findUnique({
    where: { id: clipId },
  });

  if (!clip) {
    return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }

  const existingLike = await prisma.clipLike.findUnique({
    where: {
      clipId_userId: {
        clipId,
        userId: sessionUser.id,
      },
    },
  });

  if (existingLike) {
    await prisma.clipLike.delete({
      where: { id: existingLike.id },
    });

    const likeCount = await prisma.clipLike.count({
      where: { clipId },
    });

    return NextResponse.json({ liked: false, likeCount });
  } else {
    await prisma.clipLike.create({
      data: {
        clipId,
        userId: sessionUser.id,
      },
    });

    const likeCount = await prisma.clipLike.count({
      where: { clipId },
    });

    return NextResponse.json({ liked: true, likeCount });
  }
}
