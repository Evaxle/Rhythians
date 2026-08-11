import Link from "next/link";

export default function AnnouncementsPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-accent">Announcements</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">Latest community updates</h1>
          </div>
          <Link href="/admin/announcements" className="inline-flex items-center rounded-full border border-border bg-white/5 px-4 py-2 text-sm text-muted transition hover:border-accent/40 hover:text-white">Create announcement</Link>
        </div>
      </section>
      <div className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <p className="text-sm text-muted">Published announcements will appear here once created by an administrator.</p>
      </div>
    </div>
  );
}
