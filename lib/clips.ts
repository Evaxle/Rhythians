import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";

const getCachedVideoUrl = unstable_cache(
  async (path: string) => {
    if (!supabaseAdmin) return null;
    const { data, error } = await supabaseAdmin.storage
      .from(process.env.STORAGE_BUCKET ?? "media")
      .createSignedUrl(path, 900);
    return error || !data ? null : data.signedUrl;
  },
  ["rhythians-video-url"],
  { revalidate: 600 }
);

const getCachedThumbnailUrl = unstable_cache(
  async (path: string) => {
    if (!supabaseAdmin) return null;
    const { data, error } = await supabaseAdmin.storage
      .from(process.env.STORAGE_BUCKET ?? "media")
      .createSignedUrl(path, 900);
    return error || !data ? null : data.signedUrl;
  },
  ["rhythians-thumbnail-url"],
  { revalidate: 600 }
);

export async function getVideoUrl(path: string) {
  return getCachedVideoUrl(path);
}

export async function getThumbnailUrl(path: string | null) {
  if (!path) return null;
  return getCachedThumbnailUrl(path);
}

export async function getPendingClips() {
  const pendingClips = await prisma.clip.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    include: {
      uploader: { select: { username: true, discriminator: true, displayName: true } },
      category: { select: { name: true } },
    },
  });

  return Promise.all(
    pendingClips.map(async (clip) => ({
      id: clip.id,
      title: clip.title,
      description: clip.description,
      createdAt: clip.createdAt.toISOString(),
      storagePath: clip.storagePath,
      cameraMode: clip.cameraMode,
      uploader: clip.uploader,
      category: clip.category,
      videoUrl: await getVideoUrl(clip.storagePath),
      thumbnailUrl: await getThumbnailUrl(clip.thumbnailPath),
    }))
  );
}
