export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-3xl border border-border bg-background/70 p-8 text-center text-sm text-muted">
      <p className="text-lg font-semibold text-white">{title}</p>
      <p className="mt-2">{description}</p>
    </div>
  );
}
