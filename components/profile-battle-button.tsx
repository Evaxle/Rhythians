"use client";

import { useState } from "react";
import { Search, Swords } from "lucide-react";

type MapItem = { id: string; title: string; artist?: string | null; starRating?: number | null };

export function ProfileBattleButton({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [casualOpen, setCasualOpen] = useState(false);
  const [mode, setMode] = useState<"lowest" | "middle" | "highest" | "manual">("lowest");
  const [maps, setMaps] = useState<MapItem[]>([]);
  const [query, setQuery] = useState("");
  const [selectedMap, setSelectedMap] = useState<MapItem | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function searchMaps(value = query) {
    const response = await fetch(`/api/battles/maps?q=${encodeURIComponent(value)}`, { cache: "no-store" });
    const data = await response.json();
    if (response.ok) setMaps(data.maps ?? []);
  }

  async function challenge(matchType: "casual" | "ranked") {
    setLoading(true); setError("");
    const body: Record<string, unknown> = { action: "invite", opponentId: userId, mode: "1v1", matchType };
    if (matchType === "casual") {
      body.casualMapMode = mode;
      if (mode === "manual") body.mapId = selectedMap?.id;
    }
    const response = await fetch("/api/battles/matches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    setLoading(false);
    if (!response.ok) { setError(result.error ?? "Could not send battle request."); return; }
    window.location.href = `/battles/match/${result.matchId}`;
  }

  return <div className="relative"><button onClick={() => setOpen((value) => !value)} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent2"><Swords size={16} /> 1v1 Battle</button>{open && <div className="absolute right-0 z-30 mt-2 w-80 rounded-2xl border border-border bg-surface p-3 shadow-2xl"><button disabled={loading} onClick={() => setCasualOpen((value) => !value)} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-white hover:bg-white/5">Casual</button>{casualOpen && <div className="mt-2 space-y-2 rounded-xl border border-border bg-background/50 p-2"><p className="px-2 text-xs text-muted">Choose the map pool</p><button onClick={() => setMode("lowest")} className={`w-full rounded-lg px-3 py-2 text-left text-xs ${mode === "lowest" ? "bg-accent/15 text-accent" : "text-white hover:bg-white/5"}`}>Lower rank — random map</button><button onClick={() => setMode("middle")} className={`w-full rounded-lg px-3 py-2 text-left text-xs ${mode === "middle" ? "bg-accent/15 text-accent" : "text-white hover:bg-white/5"}`}>Middle rank — random map</button><button onClick={() => setMode("highest")} className={`w-full rounded-lg px-3 py-2 text-left text-xs ${mode === "highest" ? "bg-accent/15 text-accent" : "text-white hover:bg-white/5"}`}>Higher rank — random map</button><button onClick={() => { setMode("manual"); void searchMaps(""); }} className={`w-full rounded-lg px-3 py-2 text-left text-xs ${mode === "manual" ? "bg-accent/15 text-accent" : "text-white hover:bg-white/5"}`}>Manual map selection</button>{mode === "manual" && <div className="space-y-2"><div className="flex gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void searchMaps(); }} placeholder="Search maps" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-2 text-xs text-white outline-none" /><button onClick={() => void searchMaps()} className="rounded-lg border border-border px-2.5 text-muted hover:text-white"><Search size={14} /></button></div><div className="max-h-32 space-y-1 overflow-y-auto">{maps.map((map) => <button key={map.id} onClick={() => setSelectedMap(map)} className={`w-full rounded-lg px-2.5 py-2 text-left text-xs ${selectedMap?.id === map.id ? "bg-accent/15 text-accent" : "text-white hover:bg-white/5"}`}>{map.title}</button>)}</div>{selectedMap && <p className="truncate px-1 text-[11px] text-accent">Selected: {selectedMap.title}</p>}</div>}<button disabled={loading || (mode === "manual" && !selectedMap)} onClick={() => void challenge("casual")} className="w-full rounded-xl bg-accent px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Start casual 1v1</button></div>}<button disabled={loading} onClick={() => void challenge("ranked")} className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm text-white hover:bg-white/5">Ranked</button>{error && <p className="px-2 py-2 text-xs text-red-300">{error}</p>}</div>}</div>;
}
