"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Search, Shuffle, Play } from "lucide-react";

const modes = [
  ["lowest", "Lower rank · random"],
  ["middle", "Middle rank · random"],
  ["highest", "Higher rank · random"],
  ["manual", "Manual map"],
] as const;

type MapItem = { id: string; title: string; artist?: string | null; imageUrl?: string | null; starRating?: number | null };

export function CasualMapSelection({ data, matchId, onRefresh }: { data: any; matchId: string; onRefresh: () => Promise<void> }) {
  const [mode, setMode] = useState<string>(data.match.casualMapMode ?? "lowest");
  const [query, setQuery] = useState("");
  const [maps, setMaps] = useState<MapItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [liking, setLiking] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const liked = Boolean(data.likedByViewer);
  const playerCount = data.players?.length ?? 0;
  const ready = Number(data.mapLikes ?? 0) >= playerCount && playerCount > 0;

  async function searchMaps() {
    setSearching(true);
    setError("");
    try {
      const response = await fetch(`/api/battles/maps?q=${encodeURIComponent(query)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not search maps.");
      setMaps(result.maps ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not search maps.");
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    if (mode === "manual" && maps.length === 0) void searchMaps();
  }, [mode]);

  async function selectMode(nextMode: string, mapId?: string) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/battles/matches/${encodeURIComponent(matchId)}/map-selection`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: nextMode, mapId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not select the map.");
      setMode(nextMode);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not select the map.");
    } finally {
      setSaving(false);
    }
  }

  async function likeMap() {
    setLiking(true);
    setError("");
    try {
      const response = await fetch("/api/battles/matches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "like-map", matchId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not like the map.");
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not like the map.");
    } finally {
      setLiking(false);
    }
  }

  async function startBattle() {
    setStarting(true);
    setError("");
    try {
      const response = await fetch("/api/battles/matches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start", matchId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not start the battle.");
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the battle.");
    } finally {
      setStarting(false);
    }
  }

  return <section className="rounded-3xl border border-accent/20 bg-surface/95 p-6 shadow-glow"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.22em] text-accent">Casual map selection</p><h2 className="mt-2 text-2xl font-semibold text-white">Choose the battle map</h2><p className="mt-1 text-sm text-muted">Both players must like the same map before the battle can start.</p></div><div className="rounded-full border border-border bg-background/50 px-4 py-2 text-xs font-semibold text-muted">{data.mapLikes ?? 0}/{playerCount} liked</div></div><div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{modes.map(([value, label]) => <button key={value} disabled={saving} onClick={() => value === "manual" ? setMode(value) : void selectMode(value)} className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${mode === value ? "border-accent bg-accent/10 text-accent" : "border-border bg-background/40 text-muted hover:border-accent/30 hover:text-white"}`}><Shuffle size={15} />{label}</button>)}</div>{mode === "manual" && <div className="mt-4 rounded-2xl border border-border bg-background/40 p-4"><div className="flex gap-2"><div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-background/50 px-3 py-2"><Search size={15} className="text-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void searchMaps(); }} placeholder="Search maps" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none" /></div><button disabled={searching} onClick={() => void searchMaps()} className="rounded-xl border border-border px-4 text-xs font-semibold text-white hover:border-accent/40 disabled:opacity-50">{searching ? <Loader2 size={15} className="animate-spin" /> : "Search"}</button></div><div className="mt-3 max-h-56 space-y-1 overflow-y-auto">{maps.map((map) => <button key={map.id} disabled={saving} onClick={() => void selectMode("manual", map.id)} className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition hover:bg-white/5 ${data.map?.id === map.id ? "bg-accent/10 ring-1 ring-accent/30" : ""}`}>{map.imageUrl ? <img src={map.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <div className="h-10 w-10 rounded-lg bg-white/5" />}<span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-white">{map.title}</span><span className="block truncate text-xs text-muted">{map.artist ?? "Unknown artist"}</span></span>{map.starRating != null && <span className="text-xs text-muted">{Number(map.starRating).toFixed(2)}★</span>}</button>)}</div></div>}{data.map && <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-background/40"><div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">{data.map.imageUrl ? <img src={data.map.imageUrl} alt="" className="h-24 w-full rounded-xl object-cover sm:h-20 sm:w-32" /> : null}<div className="min-w-0 flex-1"><p className="text-xs uppercase tracking-[0.18em] text-accent">Selected map</p><h3 className="mt-1 truncate text-lg font-semibold text-white">{data.map.title}</h3><p className="text-sm text-muted">{data.map.artist ?? ""}{data.map.rating != null ? ` · ${Number(data.map.rating).toFixed(2)}★` : ""}</p></div><button disabled={liking || liked} onClick={() => void likeMap()} className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold ${liked ? "border border-accent/40 bg-accent/10 text-accent" : "bg-accent text-white hover:bg-accent2"}`}>{liking ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}{liked ? "Liked" : "Like map"}</button></div></div>}{ready && <button disabled={starting} onClick={() => void startBattle()} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3.5 text-sm font-bold text-white hover:bg-accent2 disabled:opacity-50">{starting ? <Loader2 size={17} className="animate-spin" /> : <Play size={17} />}{starting ? "Starting battle..." : "Start Battle"}</button>}{error && <p className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}</section>;
}
