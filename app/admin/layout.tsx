import { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!(await canAccessAdmin(user))) redirect("/");

  return (
    <div className="grid min-h-[calc(100vh-128px)] grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
        <div className="space-y-6">
          <div><p className="text-sm uppercase tracking-[0.3em] text-accent">Admin panel</p><h2 className="mt-3 text-xl font-semibold text-white">Content & moderation</h2></div>
          <nav className="space-y-2 text-sm text-muted">
            <Link href="/admin" className="block rounded-2xl px-3 py-2 text-white transition hover:bg-white/5">Dashboard</Link>
            <div className="mt-4 border-t border-border pt-4"><p className="mb-2 uppercase tracking-[0.24em] text-[11px] text-accent">Content</p><Link href="/admin/announcements" className="block rounded-2xl px-3 py-2 transition hover:bg-white/5">Announcements</Link></div>
            <div className="mt-4 border-t border-border pt-4"><p className="mb-2 uppercase tracking-[0.24em] text-[11px] text-accent">Clips</p><Link href="/admin/clips" className="block rounded-2xl px-3 py-2 transition hover:bg-white/5">Pending</Link><Link href="/admin/clips/manage" className="block rounded-2xl px-3 py-2 transition hover:bg-white/5">Manage clips</Link><Link href="/admin/featured-clips" className="block rounded-2xl px-3 py-2 transition hover:bg-white/5">Featured</Link></div>
            <div className="mt-4 border-t border-border pt-4"><p className="mb-2 uppercase tracking-[0.24em] text-[11px] text-accent">Maps</p><Link href="/admin/maps" className="block rounded-2xl px-3 py-2 transition hover:bg-white/5">Manage maps</Link><Link href="/admin/categories" className="block rounded-2xl px-3 py-2 transition hover:bg-white/5">Category maps</Link><Link href="/admin/challenge" className="block rounded-2xl px-3 py-2 transition hover:bg-white/5">Challenge levels</Link></div>
            <div className="mt-4 border-t border-border pt-4"><p className="mb-2 uppercase tracking-[0.24em] text-[11px] text-accent">Community</p><Link href="/admin/users" className="block rounded-2xl px-3 py-2 transition hover:bg-white/5">Users</Link><Link href="/admin/alerts" className="block rounded-2xl px-3 py-2 transition hover:bg-white/5">Alerts</Link><Link href="/admin/reports" className="block rounded-2xl px-3 py-2 transition hover:bg-white/5">Reports</Link><Link href="/admin/rhythia-requests" className="block rounded-2xl px-3 py-2 transition hover:bg-white/5">Rhythia requests</Link></div>
            <div className="mt-4 border-t border-border pt-4"><p className="mb-2 uppercase tracking-[0.24em] text-[11px] text-accent">Discord</p><Link href="/admin/discord" className="block rounded-2xl px-3 py-2 transition hover:bg-white/5">Integration</Link></div>
            <div className="mt-4 border-t border-border pt-4"><p className="mb-2 uppercase tracking-[0.24em] text-[11px] text-accent">System</p><Link href="/admin/settings" className="block rounded-2xl px-3 py-2 transition hover:bg-white/5">Settings</Link></div>
          </nav>
        </div>
      </aside>
      <section>{children}</section>
    </div>
  );
}
