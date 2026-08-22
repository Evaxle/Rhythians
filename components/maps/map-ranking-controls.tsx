"use client";

import { useState } from "react";
import { CheckCircle2, Send } from "lucide-react";

export function MapRankingControls({ mapId, canRank, initialRequested }: { mapId: string; canRank: boolean; initialRequested?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [requested, setRequested] = useState(Boolean(initialRequested));
  const [ranked, setRanked] = useState(false);
  const [message, setMessage] = useState("");

  async function requestRanking() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/maps/rank-request/${mapId}`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not request ranking.");
      setRequested(true);
      setMessage("Ranking request sent to map reviewers and admins.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not request ranking.");
    } finally {
      setBusy(false);
    }
  }

  async function approveRanking() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/maps/rank-request/${mapId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ranked: true }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not approve the map.");
      setRanked(Boolean(data.ranked));
      setMessage("Map approved as ranked and enabled for RHP.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not approve the map.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-3"><div className="flex flex-wrap gap-2">{!ranked && <button type="button" onClick={() => void requestRanking()} disabled={busy || requested} className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Send size={15} />{requested ? "Ranking requested" : "Request ranking"}</button>}{canRank && !ranked && <button type="button" onClick={() => void approveRanking()} disabled={busy} className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-200 disabled:opacity-50"><CheckCircle2 size={15} />Approve as ranked</button>}</div>{message && <p className="rounded-2xl border border-accent/30 bg-accent/10 p-3 text-sm text-accent">{message}</p>}</div>;
}
