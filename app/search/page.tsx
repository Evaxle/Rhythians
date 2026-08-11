export default function SearchPage() {
  return (
    <div className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
      <h1 className="text-3xl font-semibold text-white">Search</h1>
      <p className="mt-3 text-sm leading-7 text-muted">Search articles, clips, users, and announcements across the community platform.</p>
      <div className="mt-8 rounded-3xl border border-border bg-background/70 p-6">
        <input
          className="w-full rounded-3xl border border-border bg-surface px-4 py-3 text-white outline-none transition focus:border-accent"
          placeholder="Search knowledge, clips, users..."
          aria-label="Search"
          disabled
        />
        <p className="mt-3 text-sm text-muted">Search integration will be enabled once the platform is connected to the search backend.</p>
      </div>
    </div>
  );
}
