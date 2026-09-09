import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { externalClipPath, externalThumbnailPath, type ClipSourceType, type ExternalClipSourceType } from "@/lib/clip-source";
import { resolveExternalVideoMetadata } from "@/lib/external-video-metadata";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rate = checkRateLimit(request, "clip_submit", 10, 60 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "You've submitted too many clips recently. Please try again later." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } });
  }

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const body = await request.json().catch(() => null) as {
    title?: unknown;
    description?: unknown;
    cameraMode?: unknown;
    storagePath?: unknown;
    thumbnailPath?: unknown;
    songName?: unknown;
    sourceType?: unknown;
    sourceUrl?: unknown;
  } | null;

  const sourceType = (typeof body?.sourceType === "string" ? body.sourceType : "upload") as ClipSourceType;
  const songName = typeof body?.songName === "string" ? body.songName.trim().slice(0, 120) : "";
  const cameraMode = typeof body?.cameraMode === "string" ? body.cameraMode : "";
  const validCameraModes = new Set(["lock", "spin", "vr"]);
  if (!validCameraModes.has(cameraMode) && cameraMode) return NextResponse.json({ error: "Invalid camera mode." }, { status: 400 });
  if (!["upload", "tiktok", "youtube", "twitch", "medal"].includes(sourceType)) return NextResponse.json({ error: "Invalid clip source." }, { status: 400 });

  let title = typeof body?.title === "string" ? body.title.trim() : "";
  let description = typeof body?.description === "string" ? body.description.trim().slice(0, 2000) : "";
  let storagePath = typeof body?.storagePath === "string" ? body.storagePath : "";
  let thumbnailPath = typeof body?.thumbnailPath === "string" ? body.thumbnailPath : undefined;
  let canonicalSourceUrl: string | null = null;

  if (sourceType === "upload") {
    if (!title || title.length > 120) return NextResponse.json({ error: "Title is required and must be less than 120 characters." }, { status: 400 });
    if (!storagePath || !storagePath.startsWith("clips/")) return NextResponse.json({ error: "Video storage path is required." }, { status: 400 });
    if (thumbnailPath && !thumbnailPath.startsWith("thumbnails/")) return NextResponse.json({ error: "Invalid thumbnail path." }, { status: 400 });
  } else {
    const sourceUrl = typeof body?.sourceUrl === "string" ? body.sourceUrl.trim() : "";
    if (!sourceUrl) return NextResponse.json({ error: "Video URL is required." }, { status: 400 });
    try {
      const metadata = await resolveExternalVideoMetadata(sourceType as ExternalClipSourceType, sourceUrl);
      canonicalSourceUrl = metadata.url;
      title = metadata.title.slice(0, 120);
      description = metadata.description.slice(0, 2000);
      storagePath = externalClipPath(sourceType as ExternalClipSourceType, metadata.url);
      if (metadata.thumbnailUrl) {
        const parsed = new URL(metadata.thumbnailUrl);
        if (parsed.protocol === "https:") thumbnailPath = externalThumbnailPath(parsed.toString());
      } else thumbnailPath = undefined;
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid video URL." }, { status: 400 });
    }
  }

  const userTags = await prisma.userTag.findMany({ where: { userId: user.id }, select: { tagId: true } });
  const tagIds = userTags.map((userTag) => userTag.tagId);
  const clip = await prisma.$transaction(async (tx) => tx.clip.create({
    data: {
      title,
      description,
      songName: songName || null,
      storagePath,
      thumbnailPath,
      cameraMode: validCameraModes.has(cameraMode) ? (cameraMode as "lock" | "spin" | "vr") : null,
      uploaderId: user.id,
      tags: tagIds.length > 0 ? { create: tagIds.map((tagId) => ({ tagId })) } : undefined,
    },
  }));

  await prisma.moderationAction.create({ data: { actorId: user.id, action: "clip_submitted", targetType: "clip", targetId: clip.id, metadata: { title, songName: clip.songName, tagIds, sourceType, sourceUrl: canonicalSourceUrl } } });
  return NextResponse.json({ clipId: clip.id, status: clip.status });
}
