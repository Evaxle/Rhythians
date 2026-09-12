import { ReactNode } from "react";
import { NavLink } from "@/components/nav-link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canAccessApproval } from "@/lib/approval";
import { canReviewMaps } from "@/lib/map-review";
import { RatingConversionCalculators } from "@/components/rating-conversion-calculators";

export default async function ApprovalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const reviewsPosts = await canAccessApproval(user);
  const reviewsMaps = await canReviewMaps(user);
  if (!reviewsPosts && !reviewsMaps) redirect("/");

  return (
    <div className="workspace-layout">
      <aside className="workspace-sidebar">
        <div className="space-y-6">
          <div>
            <p className="ui-eyebrow">Approval panel</p>
            <h2 className="mt-3 text-xl font-semibold text-white">
              Review team
            </h2>
          </div>
          <nav className="space-y-2 text-sm text-muted">
            {reviewsPosts && (
              <NavLink
                href="/approval"
                className="block rounded-2xl px-3 py-2 text-white transition hover:bg-white/5"
              >
                Review submissions
              </NavLink>
            )}
            {reviewsMaps && (
              <NavLink
                href="/approval/maps"
                className="block rounded-2xl px-3 py-2 text-white transition hover:bg-white/5"
              >
                Review maps
              </NavLink>
            )}
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 uppercase tracking-[0.24em] text-xs text-accent">
                Rating tools
              </p>
              <p className="px-3 text-xs leading-5 text-muted">
                Convert Rhythia star ratings and Rhythian map ratings while
                reviewing submissions.
              </p>
            </div>
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 uppercase tracking-[0.24em] text-xs text-accent">
                Site
              </p>
              <NavLink
                href="/"
                className="block rounded-2xl px-3 py-2 transition hover:bg-white/5"
              >
                Back to home
              </NavLink>
              <NavLink
                href="/notifications"
                className="block rounded-2xl px-3 py-2 transition hover:bg-white/5"
              >
                Notifications
              </NavLink>
            </div>
          </nav>
        </div>
      </aside>
      <section className="min-w-0 space-y-6">
        <RatingConversionCalculators />
        {children}
      </section>
    </div>
  );
}
