"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, ChevronDown, ChevronLeft, ChevronRight, RefreshCw, Search, ShieldCheck, ShieldOff } from "lucide-react";
import { RANKS, rankIndexForRating } from "@/lib/ranks";

type Section = { startMs: number; endMs: number; strain: number; nps: number; jumpness: number; direction: number; distance: number; pattern: string };
type Analysis = {
  analyzerVersion: number;
  status: string;
  sourceStatus: string;
  pointEligible: boolean;
  rating: number | null;
  directionScore: number | null;
  distanceScore: number | null;
  npsScore: number | null;
  staminaIndex: number | null;
  activeDurationMs: number | null;
  longestHardSectionMs: number | null;
  peakJumpNps: number | null;
  peakStreamNps: number | null;
  peakJumpStrain: number | null;
  peakStreamStrain: number | null;
  jumpRatio: number | null;
  rpl: number | null;
  rpv: number | null;
  rps: number | null;
  topSections: Section[];
  error: string | null;
};
type MapRow = {
  id: string;
  title: string;
  artist: string | null;
  mapperName: string | null;
  rating: number | null;
  noteCount: number | null;
  length: number | null;
  sourceBeatmapId: number | null;
  sourceUrl: string | null;
  sourceStatus: string;
  analysisStatus: string;
  analysis: Analysis | null;
};
type Catalog = { maps: MapRow[]; page: number; pageSize: number; total: number; pages: number; analyzerVersion: number };

function formatSeconds(milliseconds: number | null) { return milliseconds == null ? "—" : `${Math.round(milliseconds / 1000)}s`; }
function formatSectionTime(milliseconds: number) { const seconds = Math.max(0, Math.round(milliseconds / 1000)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }

export function MapAnalysisManager() {
  const [source, setSource] = useState("all");
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [busyId, setBusyId] = useState("");
  const [expandedId, setExpandedId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const params = new URLSearchParams({ source, page: String(page) });
    if (appliedQuery) params.set("q", appliedQuery);
    try {
      const response = await fetch(`/api/admin/maps/catalog?${params.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load map catalog.");
      setCatalog(data);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Could not load map catalog."); }
  }, [source, page, appliedQuery]);

  useEffect(() => { void load(); }, [load]);

  async function analyze(id: string) {
    setBusyId(id); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/maps/${id}/analyze`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Map analysis failed.");
      setMessage(`Analysis complete. Recalculated ${data.recalculatedUsers ?? 0} affected player${data.recalculatedUsers === 1 ? "" : "s"}.`);
      await load();
    } catch (analysisError) { setError(analysisError instanceof Error ? analysisError.message : "Map analysis failed."); }
    finally { setBusyId(""); }
  }

  async function setEligible(id: string, pointEligible: boolean) {
    setBusyId(id); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/maps/${id}/eligibility`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pointEligible }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not update point eligibility.");
      setMessage(`${pointEligible ? "Enabled" : "Disabled"} rank points for this map. Recalculated ${data.recalculatedUsers ?? 0} affected player${data.recalculatedUsers === 1 ? "" : "s"}.`);
      await load();
    } catch (eligibilityError) { setError(eligibilityError instanceof Error ? eligibilityError.message : "Could not update point eligibility."); }
    finally { setBusyId(""); }
  }

  return <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow sm:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-sm uppercase tracking-[0.3em] text-accent">Difficulty analyzer</p><h2 className="mt-2 text-2xl font-semibold text-white">Ranked map catalog</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Map ratings come from note direction, distance, local NPS, sustained strain and speed-sensitive pattern analysis. Rhythia star ratings are not used for ranked progression.</p></div>
      <div className="rounded-2xl border border-border bg-background/60 px-4 py-3 text-right"><p className="text-xs text-muted">Analyzer</p><p className="mt-1 font-semibold text-white">v{catalog?.analyzerVersion ?? "—"}</p></div>
    </div>
    <div className="mt-6 flex flex-col gap-3 lg:flex-row">
      <div className="flex flex-wrap gap-2">{["all", "ranked", "unranked", "legacy"].map((value) => <button key={value} onClick={() => { setSource(value); setPage(1); }} className={`rounded-full border px-4 py-2 text-xs font-semibold capitalize ${source === value ? "border-accent bg-accent/15 text-white" : "border-border text-muted hover:text-white"}`}>{value}</button>)}</div>
      <form onSubmit={(event) => { event.preventDefault(); setAppliedQuery(query.trim()); setPage(1); }} className="flex min-w-0 flex-1 gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title or mapper" className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-2 text-sm text-white outline-none focus:border-accent"/><button className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"><Search size={15}/>Search</button></form>
      <button onClick={() => void load()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-white"><RefreshCw size={15}/>Refresh</button>
    </div>
    {error ? <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p> : null}
    {message ? <p className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">{message}</p> : null}
    <div className="mt-6 space-y-3">
      {catalog?.maps.map((map) => {
        const analysis = map.analysis;
        const current = map.analysisStatus === "analyzed" && analysis?.analyzerVersion === catalog.analyzerVersion;
        const rank = map.rating == null ? null : RANKS[rankIndexForRating(map.rating)];
        const expanded = expandedId === map.id;
        return <div key={map.id} className="overflow-hidden rounded-2xl border border-border bg-background/50">
          <div className="flex flex-col gap-4 p-4 xl:flex-row xl:items-center">
            <button onClick={() => setExpandedId(expanded ? "" : map.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><ChevronDown size={16} className={`shrink-0 text-muted transition ${expanded ? "rotate-180" : ""}`}/><div className="min-w-0"><p className="truncate font-semibold text-white">{map.title}</p><p className="mt-1 truncate text-xs text-muted">{map.artist ?? "Unknown artist"} · {map.mapperName ?? "Unknown mapper"} · {map.noteCount?.toLocaleString() ?? "—"} notes</p></div></button>
            <div className="flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full border border-border px-3 py-1 capitalize text-muted">{map.sourceStatus}</span><span className={`rounded-full border px-3 py-1 capitalize ${current ? "border-emerald-400/30 text-emerald-300" : map.analysisStatus === "failed" ? "border-red-400/30 text-red-300" : "border-amber-400/30 text-amber-300"}`}>{map.analysisStatus}</span>{rank && <span className="rounded-full border border-border px-3 py-1 text-white">{rank.name} · {map.rating?.toFixed(2)}</span>}{analysis?.pointEligible ? <span className="rounded-full border border-cyan-400/30 text-cyan-200 px-3 py-1">Points enabled</span> : null}</div>
            <div className="flex flex-wrap gap-2"><button disabled={busyId === map.id} onClick={() => void analyze(map.id)} className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"><Activity size={14}/>{busyId === map.id ? "Working…" : current ? "Analyze again" : "Analyze"}</button>{current && analysis ? <button disabled={busyId === map.id} onClick={() => void setEligible(map.id, !analysis.pointEligible)} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{analysis.pointEligible ? <ShieldOff size={14}/> : <ShieldCheck size={14}/>} {analysis.pointEligible ? "Disable points" : "Enable points"}</button> : null}</div>
          </div>
          {expanded ? <div className="border-t border-border p-4">
            {!analysis ? <p className="text-sm text-muted">This map has not been analyzed yet.</p> : <div className="space-y-5">
              {analysis.error ? <p className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{analysis.error}</p> : null}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">{[
                ["Rating", analysis.rating?.toFixed(2) ?? "—"], ["Direction", analysis.directionScore?.toFixed(2) ?? "—"], ["Distance", analysis.distanceScore?.toFixed(2) ?? "—"], ["Relative NPS", analysis.npsScore?.toFixed(2) ?? "—"], ["Stamina", analysis.staminaIndex == null ? "—" : `${Math.round(analysis.staminaIndex * 100)}%`], ["Jump ratio", analysis.jumpRatio == null ? "—" : `${Math.round(analysis.jumpRatio * 100)}%`], ["Peak jump NPS", analysis.peakJumpNps?.toFixed(2) ?? "—"], ["Peak stream NPS", analysis.peakStreamNps?.toFixed(2) ?? "—"], ["Active time", formatSeconds(analysis.activeDurationMs)], ["Longest hard", formatSeconds(analysis.longestHardSectionMs)], ["RPL", analysis.rpl?.toLocaleString() ?? "—"], ["RPV / RPS", `${analysis.rpv?.toLocaleString() ?? "—"} / ${analysis.rps?.toLocaleString() ?? "—"}`],
              ].map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-black/15 p-3"><p className="text-[10px] uppercase tracking-[0.16em] text-muted">{label}</p><p className="mt-1 font-semibold text-white">{value}</p></div>)}</div>
              {analysis.topSections?.length ? <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Hardest sections</p><div className="mt-2 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-xs"><thead className="text-muted"><tr><th className="pb-2">Time</th><th className="pb-2">Pattern</th><th className="pb-2">NPS</th><th className="pb-2">Strain</th><th className="pb-2">Jump</th><th className="pb-2">Direction</th></tr></thead><tbody>{analysis.topSections.map((section, index) => <tr key={`${section.startMs}-${index}`} className="border-t border-border text-white"><td className="py-2">{formatSectionTime(section.startMs)}–{formatSectionTime(section.endMs)}</td><td className="py-2 capitalize">{section.pattern.replace("-", " ")}</td><td className="py-2">{section.nps.toFixed(2)}</td><td className="py-2">{section.strain.toFixed(2)}</td><td className="py-2">{Math.round(section.jumpness * 100)}%</td><td className="py-2">{Math.round(section.direction * 100)}%</td></tr>)}</tbody></table></div></div> : null}
            </div>}
          </div> : null}
        </div>;
      })}
      {catalog && catalog.maps.length === 0 ? <p className="rounded-2xl border border-border p-6 text-sm text-muted">No maps match this filter.</p> : null}
    </div>
    {catalog ? <div className="mt-5 flex items-center justify-between gap-3"><p className="text-xs text-muted">{catalog.total.toLocaleString()} maps · page {catalog.page} of {catalog.pages}</p><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-xl border border-border p-2 text-white disabled:opacity-30"><ChevronLeft size={16}/></button><button disabled={page >= catalog.pages} onClick={() => setPage((value) => Math.min(catalog.pages, value + 1))} className="rounded-xl border border-border p-2 text-white disabled:opacity-30"><ChevronRight size={16}/></button></div></div> : null}
  </section>;
}
