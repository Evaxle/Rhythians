"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

type MapRow = { id: string; title: string; artist: string | null; mapperName: string | null; mapFileUrl: string; imageUrl: string | null; requestedRating: number; noteCount: number | null; length: number | null; sourceUrl: string | null };

export function UnrankedMapsPanel({ canRank }: { canRank: boolean }) {
  const [maps, setMaps] = useState<MapRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/maps/unranked", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load unranked maps.");
      setMaps(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load unranked maps.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function requestRank(id: string) {
    setBusy(id); setMessage("");
    try {
      const response = await fetch(`/api/maps/rank-request/${id}`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not request ranking.");
      setMessage("Ranking request sent to map reviewers and staff.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not request ranking.");
    } finally {
      setBusy("");
    }
  }

  async function setRanked(id: string) {
    setBusy(id); setMessage("");
    try {
      const response = await fetch(`/api/maps/rank-request/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ranked: true }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not rank the map.");
      setMaps((current) => current.filter((map) => map.id !== id));
      setMessage("Map approved as ranked and enabled for RHP.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not rank the map.");
    } finally {
      setBusy("");
    }
  }

  return <section className="rounded-3xl border border-border bg-surface/95 p-5 shadow-glow"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.2em] text-accent">Unranked maps</p><h2 className="mt-1 text-xl font-semibold text-white">Rhythia community maps</h2><p className="mt-1 text-sm text-muted">These maps do not award RHP until a map reviewer, admin, or owner approves them as ranked.</p></div><button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-4 py-2 text-sm font-semibold text-white"><RefreshCw size={15} /> Refresh</button></div>{message && <p className="mt-4 rounded-2xl border border-accent/30 bg-accent/10 p-3 text-sm text-accent">{message}</p>}{loading ? <p className="mt-5 text-sm text-muted">Loading unranked maps...</p> : maps.length === 0 ? <p className="mt-5 rounded-2xl border border-dashed border-border p-6 text-sm text-muted">No unranked maps are currently synchronized.</p> : <div className="mt-5 grid gap-4 lg:grid-cols-2">{maps.map((map) => <article key={map.id} className="rounded-2xl border border-border bg-background/50 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs text-muted">{map.artist ?? "Unknown artist"}</p><h3 className="mt-1 truncate font-semibold text-white">{map.title}</h3><p className="mt-1 text-xs text-muted">Mapped by {map.mapperName ?? "Unknown"}</p></div><span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-200">Unranked</span></div><div className="mt-3 flex flex-wrap gap-2 text-xs text-muted"><span className="rounded-full border border-border bg-background/60 px-2.5 py-1">Rating {map.requestedRating.toFixed(2)}</span>{map.noteCount != null && <span className="rounded-full border border-border bg-background/60 px-2.5 py-1">{map.noteCount.toLocaleString()} notes</span>}</div><div className="mt-4 flex flex-wrap gap-2"><Link href={`/maps/${map.id}`} className="rounded-full border border-border bg-white/5 px-4 py-2 text-sm font-semibold text-white">View map</Link><button type="button" onClick={() => void requestRank(map.id)} disabled={busy === map.id} className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === map.id ? "Sending..." : "Request map to be ranked"}</button>{canRank && <button type="button" onClick={() => void setRanked(map.id)} disabled={busy === map.id} className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-200 disabled:opacity-50">Set Ranked</button>}</div></article>)}</div>}</section>;
}
