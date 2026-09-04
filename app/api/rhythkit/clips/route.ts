import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getVideoUrl, getThumbnailUrl } from "@/lib/clips";

export async function GET(request: Request) {
  const user = await import("@/lib/auth").then(({ getSessionUser }) => getSessionUser());
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const limit = Math.min(50, Math.max(1, Number(params.get("limit") ?? 24) || 24));
  const clips = await prisma.clip.findMany({
    where: { status: "approved" },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      uploader: { select: { id: true, username: true, displayName: true, profileHandle: true, avatar: true, discordId: true } },
      category: { select: { name: true } },
    },
  });
  const items = await Promise.all(clips.map(async (clip) => ({
    id: clip.id,
    title: clip.title,
    description: clip.description,
    songName: clip.songName,
    cameraMode: clip.cameraMode,
    createdAt: clip.createdAt.toISOString(),
    uploader: clip.uploader,
    category: clip.category,
    videoUrl: await getVideoUrl(clip.storagePath),
    thumbnailUrl: await getThumbnailUrl(clip.thumbnailPath),
  })));
  return NextResponse.json({ clips: items });
}
