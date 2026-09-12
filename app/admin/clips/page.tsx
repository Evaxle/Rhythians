import { ClipModerationQueue } from "@/components/clip-moderation-queue";
import { getPendingClips } from "@/lib/clips";

export const dynamic = "force-dynamic";

export default async function AdminClipsPage() {
  const clips = await getPendingClips();

  return (
    <div className="ui-page space-y-6">
      <section className="ui-page-header">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="ui-eyebrow">Clip moderation</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Review pending submissions</h1>
          </div>
        </div>
      </section>
      <ClipModerationQueue initialClips={clips} apiBase="/api/admin/clips" />
    </div>
  );
}
