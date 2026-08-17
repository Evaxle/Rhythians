"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { RANKS } from "@/lib/ranks";

export function AdminDailyRefresh() {
  const [busy, setBusy] = useState(false);
  const [rankIndex, setRankIndex] = useState(0);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  async function refresh() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/daily/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rankIndex }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not refresh the daily map.");
      setMessage({ tone: "ok", text: `Refreshed ${RANKS[rankIndex].name}! Today's map is now: ${data.map.title} (${data.map.starRating.toFixed(2)} stars)${data.replaced ? "" : " (no change needed)"}.` });
    } catch (err) {
      setMessage({ tone: "err", text: err instanceof Error ? err.message : "Could not refresh the daily map." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
      <p className="text-sm font-semibold text-white">Daily map</p>
      <p className="mt-1 text-sm text-muted">Force a new daily map pick for today if the current one is broken or unpopular.</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          value={rankIndex}
          onChange={(event) => setRankIndex(Number(event.target.value))}
          className="rounded-full border border-border bg-background px-4 py-2.5 text-sm text-white outline-none transition focus:border-accent"
        >
          {RANKS.map((rank, index) => (
            <option key={rank.name} value={index}>{rank.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => { if (window.confirm(`Refresh today's ${RANKS[rankIndex].name} daily map? This replaces it for everyone in that rank.`)) refresh(); }}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent2 disabled:opacity-60"
        >
          <RefreshCw size={15} className={busy ? "animate-spin" : ""} />
          {busy ? "Refreshing..." : "Refresh daily map"}
        </button>
        {message && (
          <p className={`rounded-xl border px-4 py-2 text-sm ${message.tone === "ok" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-red-400/30 bg-red-400/10 text-red-200"}`}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}