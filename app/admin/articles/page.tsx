import Link from "next/link";

export default function AdminArticlesPage() {
  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-accent">Articles</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">Manage knowledge content</h1>
          </div>
          <Link href="/admin/articles/new" className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent2">New article</Link>
        </div>
      </div>
      <div className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <p className="text-sm text-muted">Article management interface will be available once the first article is created.</p>
      </div>
    </div>
  );
}
