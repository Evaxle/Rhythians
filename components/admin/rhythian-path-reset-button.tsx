"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function RhythianPathResetButton({ rankIndex, rankName }: { rankIndex: number; rankName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function resetMap() {
    if (!window.confirm(`Reset the ${rankName} path map? This will assign a new map and reset path progress from this rank onward for the current season.`)) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/rhythian-path/reset-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rankIndex }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Could not reset the path map.");
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not reset the path map.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={resetMap} disabled={busy} className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-200 transition hover:bg-amber-400/20 disabled:cursor-wait disabled:opacity-50">
      <RotateCcw size={14} />
      {busy ? "Resetting..." : "Reset map"}
    </button>
  );
}
