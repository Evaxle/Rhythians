"use client";

import { useEffect, useState } from "react";
import { AdminMapControls, type ChallengeAdminTab } from "@/components/challenge/admin-map-controls";

const tabs = [["challenge", "Challenge"], ["jumps", "Jumps"], ["stream", "Stream"], ["tech", "Tech"], ["off_grid", "Off Grid"], ["vibro", "Vibro"]] as const;
const levels = Array.from({ length: 10 }, (_, index) => index + 1);

type MapRow = { id: string; title: string; artist?: string | null; mapperName?: string | null; mapFileUrl: string; rating?: number | null; status: string; level?: number | null; category?: string };

export function ChallengeCategoryManager({ isOwner = false }: { isOwner?: boolean }) {
  const [tab, setTab] = useState<ChallengeAdminTab>("challenge");
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("");
  const [maps, setMaps] = useState<MapRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(append = false) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ tab });
      if (query.trim()) params.set("q", query.trim());
      if (level) params.set("level", level);
      if (append && nextOffset != null) params.set("offset", String(nextOffset));
      const response = await fetch(`/api/admin/challenge/manage?${params.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load maps.");
      const nextMaps = Array.isArray(data.maps) ? data.maps as MapRow[] : [];
      setMaps((current) => append ? [...current, ...nextMaps] : nextMaps);
      setHasMore(Boolean(data.hasMore));
      setNextOffset(typeof data.nextOffset === "number" ? data.nextOffset : null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load maps.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { setMaps([]); setNextOffset(null); void load(false); }, [tab, level]);

  return <section className="ui-panel ui-panel-compact">
    <div className="flex flex-wrap gap-2">{tabs.map(([value, label]) => <button key={value} type="button" onClick={() => setTab(value)} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === value ? "bg-accent text-white" : "border border-border bg-white/5 text-muted hover:text-white"}`}>{label}</button>)}</div>
    <div className="mt-5 grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px_auto]"><input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void load(false); }} placeholder="Search maps by title, artist, or mapper" className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-white outline-none focus:border-accent" /><select value={level} onChange={(e) => setLevel(e.target.value)} className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-white"><option value="">All levels</option>{levels.map((value) => <option key={value} value={value}>Level {value}</option>)}</select><button type="button" onClick={() => void load(false)} disabled={loading} className="rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{loading && maps.length === 0 ? "Loading…" : "Search"}</button></div>
    <div className="mt-4 rounded-2xl border border-accent/20 bg-accent/5 p-4"><p className="text-xs uppercase tracking-[0.18em] text-accent">Assignment controls</p><p className="mt-2 text-xs leading-5 text-muted">The Challenge tab lists synchronized source maps, including ranked, unranked, and legacy maps. Use each map&apos;s admin controls to assign it to any Challenge/category Level 1–10.</p>{isOwner && <div className="mt-3 flex flex-wrap gap-2"><a href="/admin/maps" className="rounded-full border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-semibold text-white">Add or edit maps</a>{tab !== "challenge" && [7, 8, 9, 10].map((value) => <a key={value} href={`/admin/maps?category=${encodeURIComponent(tab)}&categoryLevel=${value}`} className="rounded-full border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-semibold text-white">Upload {tab} Level {value}</a>)}{tab === "challenge" && [7, 8, 9, 10].map((value) => <a key={value} href={`/admin/maps?challengeLevel=${value}`} className="rounded-full border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-semibold text-white">Upload Challenge Level {value}</a>)}</div>}</div>
    {error && <p className="mt-4 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}
    <div className="mt-5 space-y-3">{maps.length === 0 && !loading ? <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted">No maps found.</p> : maps.map((map) => <div key={map.id} className="rounded-2xl border border-border bg-background/50 p-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><h3 className="truncate font-semibold text-white">{map.title}</h3><p className="text-xs text-muted">{map.artist ?? "Unknown artist"} · {map.mapperName ?? "Unknown mapper"}</p><p className="mt-1 text-xs text-muted">{map.status}{map.level ? ` · Level ${map.level}` : " · Unassigned"}</p></div><a href={map.mapFileUrl} target="_blank" rel="noreferrer" className="w-fit rounded-full border border-border px-4 py-2 text-xs font-semibold text-white">Map</a></div><AdminMapControls mapId={map.id} currentTab={tab} currentLevel={map.level ?? 1} /></div>)}</div>
    {hasMore && <div className="mt-5 flex justify-center"><button type="button" onClick={() => void load(true)} disabled={loading || nextOffset == null} className="rounded-full border border-accent/30 bg-accent/10 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{loading ? "Loading…" : "Load 10 more"}</button></div>}
  </section>;
}
