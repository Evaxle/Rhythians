import { getSessionUser, isOwner } from "@/lib/auth";
import { ChallengeCategoryManager } from "@/components/admin/challenge-category-manager";

export const dynamic = "force-dynamic";

export default async function AdminChallengePage() {
  const user = await getSessionUser();
  const owner = Boolean(user && isOwner(user));
  return <div className="space-y-6"><section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow"><p className="text-sm uppercase tracking-[0.3em] text-accent">Challenge</p><h1 className="mt-2 text-3xl font-semibold text-white">Challenge and category management</h1><p className="mt-3 text-sm leading-7 text-muted">One unified manager for Challenge, Jumps, Stream, Tech, Off Grid, and Vibro across Levels 1-10. Ranked, unranked, and legacy source maps can all be assigned here.</p></section><ChallengeCategoryManager isOwner={owner} /></div>;
}
