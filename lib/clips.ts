import { prisma } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";

export async function getVideoUrl(path: string) {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.storage
    .from(process.env.STORAGE_BUCKET ?? "media")
    .createSignedUrl(path, 300);
  return error || !data ? null : data.signedUrl;
}

export async function getThumbnailUrl(path: string | null) {
  if (!path || !supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.storage
    .from(process.env.STORAGE_BUCKET ?? "media")
    .createSignedUrl(path, 300);
  return error || !data ? null : data.signedUrl;
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
