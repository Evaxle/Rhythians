import Link from "next/link";
import { AdminDailyRefresh } from "@/components/admin/admin-daily-refresh";
import { RatingCalculators } from "@/components/admin/rating-calculators";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <div className="grid gap-6 lg:grid-cols-4">
          {[{ title: "Users", value: "—" }, { title: "Clips", value: "—" }, { title: "Pending", value: "—" }, { title: "Reports", value: "—" }].map((card) => (
            <div key={card.title} className="rounded-3xl border border-border bg-background/70 p-6"><p className="text-sm text-muted">{card.title}</p><p className="mt-3 text-3xl font-semibold text-white">{card.value}</p></div>
          ))}
        </div>
      </section>
      <AdminDailyRefresh />
      <RatingCalculators />
      <div className="grid gap-6 lg:grid-cols-3">
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
