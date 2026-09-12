export default function Loading() {
  return (
    <div className="ui-page space-y-6" role="status" aria-label="Loading page">
      <span className="sr-only">Loading page…</span>
      <div aria-hidden="true" className="space-y-6 motion-safe:animate-pulse">
        <div className="ui-panel space-y-4">
          <div className="h-3 w-24 rounded bg-white/10" />
          <div className="h-8 w-2/3 max-w-sm rounded bg-white/10" />
          <div className="h-4 w-1/2 rounded bg-white/5" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="ui-panel h-44 bg-white/[0.03]" />
          ))}
        </div>
      </div>
    </div>
  );
}
