"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Search, Sparkles } from "lucide-react";

const labels: Record<string, string> = { lower: "Lower rank", middle: "Middle rank", higher: "Higher rank" };
const modes: Record<string, string> = { lower: "lowest", middle: "middle", higher: "highest" };

export function CasualMapSelection({ data, matchId, onRefresh }: { data: any; matchId: string; onRefresh: () => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [readying, setReadying] = useState(false);
  const [error, setError] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [maps, setMaps] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const options = data.options ?? [];
  const players = data.players ?? [];
  const viewer = players.find((player: any) => player.userId === data.viewerId);
  const readyCount = players.filter((player: any) => Boolean(player.readyAt)).length;
  const isCasual = data.match.matchType === "casual";

  useEffect(() => {
    if (!customOpen || !isCasual) return;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/battles/matches/${encodeURIComponent(matchId)}/map-selection?q=${encodeURIComponent(query)}`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not load maps.");
        setMaps(result.maps ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load maps.");
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [customOpen, query, matchId, isCasual]);

  async function select(mode: string, mapId?: string) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/battles/matches/${encodeURIComponent(matchId)}/map-selection`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, mapId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not select map.");
      setCustomOpen(false);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not select map.");
    } finally {
      setSaving(false);
    }
  }

  async function ready() {
    setReadying(true);
    setError("");
    try {
      const response = await fetch(`/api/battles/matches/${encodeURIComponent(matchId)}/ready`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not ready for battle.");
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not ready for battle.");
    } finally {
      setReadying(false);
    }
  }

  return <div className="space-y-4">
    {isCasual && <section className="rounded-[2rem] border border-accent/20 bg-surface/95 p-6 shadow-glow">
      <div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-accent"><Sparkles size={15} /> Casual map selection</p><h2 className="mt-2 text-2xl font-semibold text-white">Select the battle map</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Choose a random map for the lower, middle, or higher player rank, or select any approved custom map. Changing the map clears everyone's ready state.</p></div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">{options.map((option: any) => { const selected = data.match.mapId === option.mapId; return <button key={option.id} disabled={saving} onClick={() => void select(modes[option.bucket] ?? "middle")} className={`group overflow-hidden rounded-3xl border text-left transition ${selected ? "border-accent bg-accent/10" : "border-white/10 bg-background/40 hover:-translate-y-1 hover:border-accent/30"}`}><div className="relative aspect-[4/3] overflow-hidden bg-white/5">{option.imageUrl ? <img src={option.imageUrl} alt="" className="h-full w-full object-cover transition group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-muted">No image</div>}<span className="absolute left-3 top-3 rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-white">{labels[option.bucket] ?? option.bucket}</span></div><div className="p-4"><p className="truncate text-lg font-semibold text-white">{option.title}</p><p className="mt-1 truncate text-xs text-muted">{option.artist ?? "Unknown artist"}{option.rating != null ? ` · ${Number(option.rating).toFixed(2)}★` : ""}</p>{selected && <p className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent"><Check size={13} /> Selected</p>}</div></button>; })}</div>
      <button disabled={saving} onClick={() => setCustomOpen((value) => !value)} className="mt-4 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white">Custom map</button>
      {customOpen && <div className="mt-4 rounded-3xl border border-white/10 bg-black/15 p-4"><div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3"><Search size={16} className="text-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search custom maps..." className="w-full bg-transparent py-3 text-sm text-white outline-none placeholder:text-muted" /></div>{searching ? <p className="mt-4 flex items-center gap-2 text-sm text-muted"><Loader2 size={15} className="animate-spin" />Loading maps...</p> : <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">{maps.map((map) => <button key={map.id} disabled={saving} onClick={() => void select("manual", map.id)} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left hover:border-accent/30">{map.imageUrl && <img src={map.imageUrl} alt="" className="h-12 w-16 rounded-xl object-cover" />}<span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-white">{map.title}</span><span className="block truncate text-xs text-muted">{map.artist ?? "Unknown artist"}{map.rating != null ? ` · ${Number(map.rating).toFixed(2)}★` : ""}</span></span></button>)}</div>}</div>}
    </section>}

    <section className="ui-card rounded-[2rem] p-6 text-center"><p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Ready check</p><h2 className="mt-2 text-xl font-semibold text-white">{data.map ? data.map.title : isCasual ? "Select a map first" : "Ranked map preparing"}</h2><p className="mt-2 text-sm text-muted">{readyCount}/{players.length} players ready. The match cannot start until every player presses Ready.</p><button disabled={readying || Boolean(viewer?.readyAt) || !data.match.mapId} onClick={() => void ready()} className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-bold text-white disabled:opacity-40">{readying ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}{viewer?.readyAt ? "Ready" : "Ready"}</button>{viewer?.readyAt && <p className="mt-3 text-xs text-emerald-300">You are ready. Waiting for the other player{players.length === 2 ? "" : "s"}.</p>}</section>
    {saving && <p className="flex items-center gap-2 text-sm text-muted"><Loader2 className="animate-spin" size={16} />Selecting map...</p>}
    {error && <p className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-300">{error}</p>}
  </div>;
}
