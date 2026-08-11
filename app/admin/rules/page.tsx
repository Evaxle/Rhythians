export default function AdminRulesPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-accent">Rules</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">Manage server rules</h1>
          </div>
          <button className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent2">Create rule</button>
        </div>
      </section>
      <div className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <p className="text-sm text-muted">Rule management will allow creating, editing, ordering, and enabling server rules.</p>
      </div>
    </div>
  );
}
