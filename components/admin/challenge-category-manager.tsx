"use client";

import { useEffect, useState } from "react";

const tabs = [["challenge", "Challenge"], ["jumps", "Jumps"], ["stream", "Stream"], ["tech", "Tech"], ["off_grid", "Off Grid"], ["vibro", "Vibro"]] as const;
const levels = Array.from({ length: 10 }, (_, index) => index + 1);

type MapRow = { id: string; title: string; artist?: string | null; mapperName?: string | null; mapFileUrl: string; rating?: number | null; status: string; level?: number | null; category?: string };

export function ChallengeCategoryManager({ isOwner = false }: { isOwner?: boolean }) {
  const [tab, setTab] = useState("challenge");
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("");
  const [maps, setMaps] = useState<MapRow[]>([]);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const params = new URLSearchParams({ tab });
    if (query.trim()) params.set("q", query.trim());
    if (level) params.set("level", level);
    const response = await fetch(`/api/admin/challenge/manage?${params.toString()}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) return setError(data.error ?? "Could not load maps.");
    setMaps(data);
  }

  useEffect(() => { void load(); }, [tab, level]);

  async function assign(mapId: string, value: string) {
    const nextLevel = Number(value);
    if (!Number.isInteger(nextLevel) || nextLevel < 1 || nextLevel > 10) return;
    setBusy(mapId); setMessage(""); setError("");
    try {
      const response = await fetch("/api/admin/challenge/manage", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tab, mapId, level: nextLevel }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not assign map.");
      setMessage(`${tab === "challenge" ? "Challenge" : tab} map assigned to Level ${nextLevel}.`);
      await load();
    } catch (assignError) { setError(assignError instanceof Error ? assignError.message : "Could not assign map."); } finally { setBusy(""); }
  }

  return <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow"><div className="flex flex-wrap gap-2">{tabs.map(([value, label]) => <button key={value} type="button" onClick={() => setTab(value)} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === value ? "bg-accent text-white" : "border border-border bg-white/5 text-muted hover:text-white"}`}>{label}</button>)}</div><div className="mt-5 grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px_auto]"><input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void load(); }} placeholder="Search maps by title, artist, or mapper" className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-white outline-none focus:border-accent" /><select value={level} onChange={(e) => setLevel(e.target.value)} className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-white"><option value="">All levels</option>{levels.map((value) => <option key={value} value={value}>Level {value}</option>)}</select><button type="button" onClick={() => void load()} className="rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-white">Search</button></div>{isOwner && <div className="mt-4 rounded-2xl border border-accent/20 bg-accent/5 p-4"><p className="text-xs uppercase tracking-[0.18em] text-accent">Owner map uploads</p><div className="mt-3 flex flex-wrap gap-2">{tab !== "challenge" && [7, 8, 9, 10].map((value) => <a key={value} href={`/admin/maps?category=${encodeURIComponent(tab)}&categoryLevel=${value}`} className="rounded-full border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-semibold text-white">Upload {tab} Level {value}</a>)}{tab === "challenge" && [7, 8, 9, 10].map((value) => <a key={value} href={`/admin/maps?challengeLevel=${value}`} className="rounded-full border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-semibold text-white">Upload Challenge Level {value}</a>)}</div></div>}{message && <p className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200">{message}</p>}{error && <p className="mt-4 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}<div className="mt-5 space-y-3">{maps.length === 0 ? <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted">No maps found.</p> : maps.map((map) => <div key={map.id} className="flex flex-col gap-4 rounded-2xl border border-border bg-background/50 p-4 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><h3 className="truncate font-semibold text-white">{map.title}</h3><p className="text-xs text-muted">{map.artist ?? "Unknown artist"} · {map.mapperName ?? "Unknown mapper"}</p><p className="mt-1 text-xs text-muted">{map.status}{map.level ? ` · Level ${map.level}` : ""}</p></div><div className="flex flex-wrap items-center gap-2"><a href={map.mapFileUrl} target="_blank" rel="noreferrer" className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-white">Map</a><select defaultValue={map.level ? String(map.level) : ""} onChange={(e) => void assign(map.id, e.target.value)} disabled={busy === map.id} className="rounded-full border border-border bg-background px-4 py-2 text-sm text-white"><option value="">Assign level</option>{levels.map((value) => <option key={value} value={value}>Level {value}</option>)}</select></div></div>)}</div></section>;
}
