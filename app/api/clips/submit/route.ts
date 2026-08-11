import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

const VALID_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_UPLOAD_SIZE_BYTES = Number(process.env.MAX_CLIP_UPLOAD_SIZE_BYTES ?? 524288000);

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await request.json();
  const { title, description, categoryId, tagIds, storagePath, thumbnailPath } = body as {
    title?: string;
    description?: string;
    categoryId?: string;
    tagIds?: string[];
    storagePath?: string;
    thumbnailPath?: string;
  };

  if (!title || typeof title !== "string" || title.length > 120) {
    return NextResponse.json({ error: "Title is required and must be less than 120 characters." }, { status: 400 });
  }
  if (!categoryId) {
    return NextResponse.json({ error: "Category is required." }, { status: 400 });
  }
  if (!storagePath) {
    return NextResponse.json({ error: "Video storage path is required." }, { status: 400 });
  }

  const category = await prisma.clipCategory.findUnique({ where: { id: categoryId } });
  if (!category) {
    return NextResponse.json({ error: "Selected category does not exist." }, { status: 400 });
  }

  const validatedTagIds = Array.isArray(tagIds) ? tagIds.filter((id) => typeof id === "string") : [];
  if (validatedTagIds.length > 0) {
    const existingTags = await prisma.tag.findMany({ where: { id: { in: validatedTagIds } } });
    if (existingTags.length !== validatedTagIds.length) {
      return NextResponse.json({ error: "One or more tag selections are invalid." }, { status: 400 });
    }
  }

  const clip = await prisma.clip.create({
    data: {
      title,
      description: description ?? "",
      storagePath,
      thumbnailPath,
      uploaderId: user.id,
      categoryId,
      tags: {
        create: validatedTagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })),
      },
    },
  });

  await prisma.moderationAction.create({
    data: {
      actorId: user.id,
      action: "clip_submitted",
      targetType: "clip",
      targetId: clip.id,
      metadata: { title, category: category.name },
    },
  });

  return NextResponse.json({ clipId: clip.id, status: clip.status });
}
