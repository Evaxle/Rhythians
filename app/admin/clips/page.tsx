import { prisma } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";
import { ClipModerationQueue } from "@/components/clip-moderation-queue";

export const dynamic = "force-dynamic";

async function getVideoUrl(path: string) {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.storage.from(process.env.STORAGE_BUCKET ?? "media").createSignedUrl(path, 300);
  return error || !data ? null : data.signedUrl;
}

export default async function AdminClipsPage() {
  const pendingClips = await prisma.clip.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    include: { uploader: { select: { username: true, discriminator: true } }, category: { select: { name: true } } },
  });
  const clips = await Promise.all(pendingClips.map(async (clip) => ({
    id: clip.id,
    title: clip.title,
    description: clip.description,
    createdAt: clip.createdAt.toISOString(),
    storagePath: clip.storagePath,
    uploader: clip.uploader,
    category: clip.category,
    videoUrl: await getVideoUrl(clip.storagePath),
  })));

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-accent">Clip moderation</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">Review pending submissions</h1>
          </div>
        </div>
      </section>
      <ClipModerationQueue initialClips={clips} />
    </div>
  );
}
