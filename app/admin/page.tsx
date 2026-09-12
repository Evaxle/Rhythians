import Link from "next/link";
import { AdminDailyRefresh } from "@/components/admin/admin-daily-refresh";
import { RatingCalculators } from "@/components/admin/rating-calculators";

export default function AdminDashboardPage() {
  return (
    <div className="ui-page space-y-6">
      <section className="ui-panel">
        <div className="grid gap-6 lg:grid-cols-4">
          {[{ title: "Users", value: "—" }, { title: "Clips", value: "—" }, { title: "Pending", value: "—" }, { title: "Reports", value: "—" }].map((card) => (
            <div key={card.title} className="rounded-3xl border border-border bg-background/70 p-6"><p className="text-sm text-muted">{card.title}</p><p className="mt-2 text-3xl font-semibold tracking-tight text-white">{card.value}</p></div>
          ))}
        </div>
      </section>
      <AdminDailyRefresh />
      <RatingCalculators />
      <div className="grid gap-6 lg:grid-cols-3">
        <Link href="/admin/ranking" className="rounded-3xl border border-accent/30 bg-accent/10 p-6 text-sm font-semibold text-white transition hover:border-accent/60">Ranking system controls</Link>
        <Link href="/admin/users" className="rounded-3xl border border-border bg-surface/95 p-6 text-sm text-white transition hover:border-accent/40">Users and rating tools</Link>
        <Link href="/admin/maps" className="rounded-3xl border border-border bg-surface/95 p-6 text-sm text-white transition hover:border-accent/40">Manage ranked maps</Link>
        <Link href="/admin/clips" className="rounded-3xl border border-border bg-surface/95 p-6 text-sm text-white transition hover:border-accent/40">Review clips</Link>
        <Link href="/admin/clips/manage" className="rounded-3xl border border-border bg-surface/95 p-6 text-sm text-white transition hover:border-accent/40">Manage clips</Link>
        <Link href="/admin/announcements" className="rounded-3xl border border-border bg-surface/95 p-6 text-sm text-white transition hover:border-accent/40">Manage announcements</Link>
        <Link href="/admin/discord" className="rounded-3xl border border-border bg-surface/95 p-6 text-sm text-white transition hover:border-accent/40">Discord integration</Link>
        <Link href="/admin/reports" className="rounded-3xl border border-border bg-surface/95 p-6 text-sm text-white transition hover:border-accent/40">Reports</Link>
        <Link href="/approval/maps" className="rounded-3xl border border-border bg-surface/95 p-6 text-sm text-white transition hover:border-accent/40">Review maps</Link>
      </div>
    </div>
  );
}
