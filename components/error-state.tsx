export function ErrorState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-3xl border border-red-600/30 bg-red-500/10 p-8 text-center text-sm text-red-100">
      <p className="text-lg font-semibold">{title}</p>
      <p className="mt-2 text-muted">{description}</p>
    </div>
  );
}
