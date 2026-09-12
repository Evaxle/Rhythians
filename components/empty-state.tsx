export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-white/[0.015] px-5 py-10 text-center text-sm text-muted">
      <p className="text-lg font-semibold text-white">{title}</p>
      <p className="mx-auto mt-2 max-w-md leading-6">{description}</p>
    </div>
  );
}
