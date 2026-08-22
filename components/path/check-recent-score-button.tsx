"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

export function CheckRecentScoreButton({ rankIndex, completed, disabled }: { rankIndex: number; completed: boolean; disabled?: boolean }) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function checkScore() {
    setChecking(true);
    setMessage(null);
    try {
      const response = await fetch("/api/path/check-score", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rankIndex }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Unable to check recent score.");
      setMessage(data.message ?? "Score check complete.");
      if (data.status === "completed") router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to check recent score.");
    } finally {
      setChecking(false);
    }
  }

  if (completed) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <button type="button" onClick={checkScore} disabled={disabled || checking} className="inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-accent/40 disabled:cursor-not-allowed disabled:opacity-50">
        <RefreshCw size={15} className={checking ? "animate-spin" : ""} />
        {checking ? "Checking recent score..." : "Check recent score"}
      </button>
      {message && <span className="text-xs text-muted" role="status">{message}</span>}
    </div>
  );
}
