"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to the console so it shows up in Vercel function logs.
    console.error("Rhythians page error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 rounded-3xl border border-border bg-surface/95 p-8 text-center shadow-glow">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15 text-2xl">
        ⚠️
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-white">Something went wrong</h2>
        <p className="max-w-md text-sm leading-6 text-muted">
          The page hit a server error. This is usually caused by a missing environment variable
          (like <code className="rounded bg-background/80 px-1.5 py-0.5 text-accent">DATABASE_URL</code>)
          or the database being unreachable. Check the Vercel function logs for details.
        </p>
        {error?.message && (
          <p className="mx-auto max-w-md break-words rounded-xl border border-border bg-background/70 p-3 text-left font-mono text-xs text-red-300">
            {error.message}
          </p>
        )}
      </div>
      <button
        onClick={reset}
        className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent2"
      >
        Try again
      </button>
    </div>
  );
}
