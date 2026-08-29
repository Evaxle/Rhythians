import { MapReviewQueueV2 } from "@/components/map-review-queue-v2";
import { getPendingChallengeMaps } from "@/lib/maps";
import { getMapSubmissionMetadataMap } from "@/lib/map-submission-metadata";
import { getSessionUser } from "@/lib/auth";
import { canReviewMaps } from "@/lib/map-review";
import { syncAndAutoReviewRhythiaMaps } from "@/lib/rhythia-auto-review";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ApprovalMapsPage() {
  const user = await getSessionUser();
  if (!user || !(await canReviewMaps(user))) redirect("/approval");

  const autoImportedPending = await prisma.challengeMap.count({ where: { status: "pending", isAutoImported: true } });
  if (autoImportedPending > 0) {
    try { await syncAndAutoReviewRhythiaMaps(); } catch {}
  }

  const maps = (await getPendingChallengeMaps()).filter((map) => !map.isAutoImported);
  const metadata = await getMapSubmissionMetadataMap(maps.map((map) => map.id));
  const pending = maps.map((map) => {
    const meta = metadata.get(map.id);
    return {
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
      submissionType: meta?.submissionType ?? "ranked" as const,
      challengePlacement: meta?.challengePlacement ?? null,
      challengeLevel: meta?.challengeLevel ?? null,
      submittedBy: {
        username: map.submittedBy.username,
        displayName: map.submittedBy.displayName,
        profileHandle: map.submittedBy.profileHandle,
        avatar: map.submittedBy.avatar,
      },
    };
  });

  return <div className="space-y-8"><section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow"><p className="text-sm uppercase tracking-[0.3em] text-accent">Map review team</p><h1 className="mt-3 text-3xl font-semibold text-white">Review pending map submissions</h1><p className="mt-3 text-sm leading-7 text-muted">Ranked submissions join the ranked map pool and use RHP. Challenge submissions are placed into the Main Challenge or a skill category at the selected level and never award RHP.</p></section><MapReviewQueueV2 initialMaps={pending} /></div>;
}
