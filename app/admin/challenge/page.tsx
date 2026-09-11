import Link from "next/link";
import { ChallengeCategoryManager } from "@/components/admin/challenge-category-manager";
import { getSessionUser, isOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminChallengePage() {
  const user = await getSessionUser();
  const owner = Boolean(user && isOwner(user));

  return <div className="space-y-6">
    <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
      <p className="text-sm uppercase tracking-[0.3em] text-accent">Challenge</p>
      <h1 className="mt-2 text-3xl font-semibold text-white">Challenge and category management</h1>
      <p className="mt-3 text-sm leading-7 text-muted">
        One assignment system for Challenge, Jumps, Stream, Tech, Off Grid, and Vibro across Levels 1–10.
        Ranked, unranked, and legacy maps can all be assigned. Difficulty v5 and Challenge Fit v2 recommendations come
        from raw map data and are available from Manage Maps.
      </p>
      <Link href="/admin/maps" className="mt-4 inline-flex rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-xs font-semibold text-white">
        Open Manage Maps + Analyzer v5
      </Link>
    </section>
    <ChallengeCategoryManager isOwner={owner} />
  </div>;
}
