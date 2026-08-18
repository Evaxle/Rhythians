export function LoadingState({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="rounded-3xl border border-border bg-surface/95 p-8 text-center text-sm text-muted">
      <p>{message}</p>
    </div>
  );
}
