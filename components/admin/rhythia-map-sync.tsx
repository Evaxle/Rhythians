"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

export function RhythiaMapSync() {
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function sync(status: "RANKED" | "UNRANKED" | "LEGACY") {
    setBusy(status);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/maps/rhythia-sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Synchronization failed.");
      const count = status === "RANKED" ? data.ranked : status === "UNRANKED" ? data.unranked : data.legacy;
      setMessage(`${status === "RANKED" ? "Ranked" : status === "UNRANKED" ? "Unranked" : "Legacy"} sync complete: ${count} Rhythia maps checked, ${data.created} added, ${data.updated} updated, ${data.promoted} promoted.`);
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Synchronization failed.");
    } finally {
      setBusy("");
    }
  }

  return <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow"><div><p className="text-sm uppercase tracking-[0.24em] text-accent">Rhythia synchronization</p><h2 className="mt-2 text-xl font-semibold text-white">Sync Rhythia maps</h2><p className="mt-2 text-sm leading-6 text-muted">Pull the complete Rhythia ranked, unranked, or legacy catalog and update Rhythians without creating duplicates.</p></div><div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={() => void sync("RANKED")} disabled={Boolean(busy)} className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><RefreshCw size={16} className={busy === "RANKED" ? "animate-spin" : ""} /> {busy === "RANKED" ? "Syncing ranked..." : "Sync all Rhythia ranked maps"}</button><button type="button" onClick={() => void sync("UNRANKED")} disabled={Boolean(busy)} className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-5 py-2.5 text-sm font-semibold text-amber-200 disabled:opacity-50"><RefreshCw size={16} className={busy === "UNRANKED" ? "animate-spin" : ""} /> {busy === "UNRANKED" ? "Syncing unranked..." : "Sync all Rhythia unranked maps"}</button><button type="button" onClick={() => void sync("LEGACY")} disabled={Boolean(busy)} className="inline-flex items-center gap-2 rounded-full border border-violet-400/40 bg-violet-400/10 px-5 py-2.5 text-sm font-semibold text-violet-200 disabled:opacity-50"><RefreshCw size={16} className={busy === "LEGACY" ? "animate-spin" : ""} /> {busy === "LEGACY" ? "Syncing legacy..." : "Sync all Rhythia legacy maps"}</button></div>{message && <p className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200">{message}</p>}{error && <p className="mt-4 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}</section>;
}
