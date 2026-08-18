import { ClipModerationQueue } from "@/components/clip-moderation-queue";
import { ReviewerWelcome } from "@/components/reviewer-welcome";
import { getPendingClips } from "@/lib/clips";
import { getSessionUser } from "@/lib/auth";
import { canAccessApproval } from "@/lib/approval";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ApprovalPage() {
  const user = await getSessionUser();
  if (!user || !(await canAccessApproval(user))) redirect("/approval/maps");

  const clips = await getPendingClips();

  return (
    <div className="space-y-8">
      <ReviewerWelcome />
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-accent">Approval team</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">Review pending submissions</h1>
            <p className="mt-3 text-sm leading-7 text-muted">
              Approve clips or deny them with feedback. The uploader is notified either way, and the
              feedback you give on a denial is sent to them so they can fix it and resubmit.
            </p>
          </div>
        </div>
      </section>
      <ClipModerationQueue initialClips={clips} apiBase="/api/approval/clips" />
    </div>
  );
}
