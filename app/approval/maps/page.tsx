import { MapReviewQueue } from "@/components/map-review-queue";
import { getPendingChallengeMaps } from "@/lib/maps";
import { getSessionUser } from "@/lib/auth";
import { canReviewMaps } from "@/lib/map-review";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ApprovalMapsPage() {
  const user = await getSessionUser();
  if (!user || !(await canReviewMaps(user))) redirect("/approval");

  const maps = await getPendingChallengeMaps();

  const pending = maps.map((map) => ({
    id: map.id,
    title: map.title,
    artist: map.artist,
    description: map.description,
    mapFileUrl: map.mapFileUrl,
    imageUrl: map.imageUrl,
    sourceUrl: map.sourceUrl,
    requestedRating: map.requestedRating,
    mapperName: map.mapperName,
    noteCount: map.noteCount,
    length: map.length,
    createdAt: map.createdAt.toISOString(),
    submittedBy: {
      username: map.submittedBy.username,
      displayName: map.submittedBy.displayName,
      profileHandle: map.submittedBy.profileHandle,
      avatar: map.submittedBy.avatar,
    },
  }));

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-accent">Map review team</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">Review pending map submissions</h1>
            <p className="mt-3 text-sm leading-7 text-muted">
              Approve ranked maps or reject them with feedback. When approving, set the final rating (two decimals) —
              this determines which ranks can play the map. The submitter is notified either way.
            </p>
          </div>
        </div>
      </section>
      <MapReviewQueue initialMaps={pending} />
    </div>
  );
}