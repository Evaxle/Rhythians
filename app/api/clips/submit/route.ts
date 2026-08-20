import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";

const VALID_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_UPLOAD_SIZE_BYTES = Number(process.env.MAX_CLIP_UPLOAD_SIZE_BYTES ?? 524288000);

export async function POST(request: Request) {
  const rate = checkRateLimit(request, "clip_submit", 10, 60 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "You've submitted too many clips recently. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await request.json();
  const { title, description, cameraMode, storagePath, thumbnailPath, songName } = body as {
    title?: string;
    description?: string;
    cameraMode?: string;
    storagePath?: string;
    thumbnailPath?: string;
    songName?: string;
  };

  const validCameraModes = new Set(["lock", "spin", "vr"]);
  if (cameraMode && typeof cameraMode === "string" && !validCameraModes.has(cameraMode)) {
    return NextResponse.json({ error: "Invalid camera mode." }, { status: 400 });
  }

  if (!title || typeof title !== "string" || title.length > 120) {
    return NextResponse.json({ error: "Title is required and must be less than 120 characters." }, { status: 400 });
  }
  if (!storagePath) {
    return NextResponse.json({ error: "Video storage path is required." }, { status: 400 });
  }

  const userTags = await prisma.userTag.findMany({
    where: { userId: user.id },
    select: { tagId: true },
  });
  const tagIds = userTags.map((userTag) => userTag.tagId);

  const clip = await prisma.$transaction(async (tx) => {
    const created = await tx.clip.create({
      data: {
        title,
        description: description ?? "",
        songName: typeof songName === "string" && songName.trim() ? songName.trim().slice(0, 120) : null,
        storagePath,
        thumbnailPath,
        cameraMode: validCameraModes.has(cameraMode ?? "") ? (cameraMode as "lock" | "spin" | "vr") : null,
        uploaderId: user.id,
        tags: tagIds.length > 0 ? { create: tagIds.map((tagId) => ({ tagId })) } : undefined,
      },
    });
    return created;
  });

  await prisma.moderationAction.create({
    data: {
      actorId: user.id,
      action: "clip_submitted",
      targetType: "clip",
      targetId: clip.id,
      metadata: { title, songName: clip.songName, tagIds },
    },
  });

  return NextResponse.json({ clipId: clip.id, status: clip.status });
}
