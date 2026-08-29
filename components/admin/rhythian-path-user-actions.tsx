"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RhythianPathUserActions({ userId, pathRank }: { userId: string; pathRank: number }) {
  const router = useRouter();
  const [saving, setSaving] = useState<"up" | "down" | null>(null);
  const [error, setError] = useState("");

  async function move(direction: "up" | "down") {
    if (saving) return;
    setSaving(direction);
    setError("");
    try {
      const response = await fetch("/api/admin/rhythian-path/move-user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, direction }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not move player.");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not move player.");
    } finally {
      setSaving(null);
    }
  }

  const canMoveUp = pathRank < 8;
  const canMoveDown = pathRank >= 0;

  return <div className="ml-3 flex shrink-0 items-center gap-1" onClick={(event) => event.preventDefault()}>
    <button type="button" onClick={() => void move("up")} disabled={!canMoveUp || saving !== null} aria-label="Move player up one path rank" title="Move up one path rank" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white/5 text-muted transition hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:opacity-30">
      <ArrowUp size={15} />
    </button>
    <button type="button" onClick={() => void move("down")} disabled={!canMoveDown || saving !== null} aria-label="Move player down one path rank" title="Move down one path rank" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white/5 text-muted transition hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:opacity-30">
      <ArrowDown size={15} />
    </button>
    {error && <span className="absolute z-10 mt-16 max-w-56 rounded-lg border border-red-400/30 bg-background px-2 py-1 text-[10px] text-red-200 shadow-lg">{error}</span>}
  </div>;
}
