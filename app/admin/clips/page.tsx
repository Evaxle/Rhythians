import { ClipModerationQueue } from "@/components/clip-moderation-queue";
import { getPendingClips } from "@/lib/clips";

export const dynamic = "force-dynamic";

export default async function AdminClipsPage() {
  const clips = await getPendingClips();

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
      <ClipModerationQueue initialClips={clips} apiBase="/api/admin/clips" />
    </div>
  );
}
