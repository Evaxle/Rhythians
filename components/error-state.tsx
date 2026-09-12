export function ErrorState({ title, description }: { title: string; description: string }) {
  return (
    <div role="alert" className="rounded-2xl border border-red-400/25 bg-red-500/[0.06] px-5 py-8 text-center text-sm text-red-100">
      <p className="text-lg font-semibold">{title}</p>
      <p className="mt-2 text-muted">{description}</p>
    </div>
  );
}
