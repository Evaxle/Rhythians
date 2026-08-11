export default function AdminClipsPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-accent">Clip moderation</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">Review pending submissions</h1>
          </div>
          <button className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent2">Refresh queue</button>
        </div>
      </section>
      <div className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <p className="text-sm text-muted">Clips moderation tools will be available once submissions are stored in the database.</p>
      </div>
    </div>
  );
}
