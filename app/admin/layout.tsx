import { ReactNode } from "react";
import { NavLink } from "@/components/nav-link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getSessionUser();
  if (!user || !(await canAccessAdmin(user))) redirect("/");
  return (
    <div className="workspace-layout">
      <aside className="workspace-sidebar">
        <div className="space-y-6">
          <div>
            <p className="ui-eyebrow">Admin panel</p>
            <h2 className="mt-3 text-xl font-semibold text-white">
              Content & moderation
            </h2>
          </div>
          <nav className="space-y-2 text-sm text-muted">
            <NavLink
              href="/admin"
              className="block rounded-2xl px-3 py-2 text-white transition hover:bg-white/5"
            >
              Dashboard
            </NavLink>
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 uppercase tracking-[0.24em] text-xs text-accent">
                Content
              </p>
              <NavLink
                href="/admin/announcements"
                className="block rounded-2xl px-3 py-2 transition hover:bg-white/5"
              >
                Announcements
              </NavLink>
            </div>
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 uppercase tracking-[0.24em] text-xs text-accent">
                Clips
              </p>
              <NavLink
                href="/admin/clips"
                className="block rounded-2xl px-3 py-2 transition hover:bg-white/5"
              >
                Pending
              </NavLink>
              <NavLink
                href="/admin/completion-clips"
                className="block rounded-2xl px-3 py-2 transition hover:bg-white/5"
              >
                Completion review
              </NavLink>
              <NavLink
                href="/admin/clips/manage"
                className="block rounded-2xl px-3 py-2 transition hover:bg-white/5"
              >
                Manage clips
              </NavLink>
              <NavLink
                href="/admin/featured-clips"
                className="block rounded-2xl px-3 py-2 transition hover:bg-white/5"
              >
                Featured
              </NavLink>
            </div>
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 uppercase tracking-[0.24em] text-xs text-accent">
                Maps
              </p>
              <NavLink
                href="/admin/maps"
                className="block rounded-2xl px-3 py-2 transition hover:bg-white/5"
              >
                Manage maps
              </NavLink>
              <NavLink
                href="/admin/categories"
                className="block rounded-2xl px-3 py-2 transition hover:bg-white/5"
              >
                Category maps
              </NavLink>
              <NavLink
                href="/admin/challenge"
                className="block rounded-2xl px-3 py-2 transition hover:bg-white/5"
              >
                Challenge levels
              </NavLink>
            </div>
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 uppercase tracking-[0.24em] text-xs text-accent">
                Competition
              </p>
              <NavLink
                href="/admin/tournaments"
                className="block rounded-2xl px-3 py-2 transition hover:bg-white/5"
              >
                Tournament overview
              </NavLink>
              <NavLink
                href="/admin/tournaments/signups"
                className="block rounded-2xl px-3 py-2 transition hover:bg-white/5"
              >
                Tournament signups
              </NavLink>
              <NavLink
                href="/admin/tournaments/maps"
                className="block rounded-2xl px-3 py-2 transition hover:bg-white/5"
              >
                Tournament map pools
              </NavLink>
              <NavLink
                href="/admin/tournaments/live"
                className="block rounded-2xl px-3 py-2 transition hover:bg-white/5"
              >
                Live operations
              </NavLink>
            </div>
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 uppercase tracking-[0.24em] text-xs text-accent">
                Community
              </p>
              <NavLink
                href="/admin/users"
                className="block rounded-2xl px-3 py-2 transition hover:bg-white/5"
              >
                Users
              </NavLink>
              <NavLink
                href="/admin/rhythia-requests"
                className="block rounded-2xl px-3 py-2 transition hover:bg-white/5"
              >
                Rhythia requests
              </NavLink>
              <NavLink
                href="/admin/rhythian-path"
                className="block rounded-2xl px-3 py-2 transition hover:bg-white/5"
              >
                Rhythian Path
              </NavLink>
              <NavLink
                href="/admin/alerts"
                className="block rounded-2xl px-3 py-2 transition hover:bg-white/5"
              >
                Alerts
              </NavLink>
              <NavLink
                href="/admin/reports"
                className="block rounded-2xl px-3 py-2 transition hover:bg-white/5"
              >
                Reports
              </NavLink>
            </div>
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 uppercase tracking-[0.24em] text-xs text-accent">
                Discord
              </p>
              <NavLink
                href="/admin/discord"
                className="block rounded-2xl px-3 py-2 transition hover:bg-white/5"
              >
                Integration
              </NavLink>
            </div>
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 uppercase tracking-[0.24em] text-xs text-accent">
                System
              </p>
              <NavLink
                href="/admin/ranking"
                className="block rounded-2xl px-3 py-2 transition hover:bg-white/5"
              >
                Ranking controls
              </NavLink>
              <NavLink
                href="/admin/settings"
                className="block rounded-2xl px-3 py-2 transition hover:bg-white/5"
              >
                Settings
              </NavLink>
            </div>
          </nav>
        </div>
      </aside>
      <section className="min-w-0">{children}</section>
    </div>
  );
}
