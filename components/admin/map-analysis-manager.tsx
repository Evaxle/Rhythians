"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, ChevronDown, ChevronLeft, ChevronRight, RefreshCw, Search, ShieldCheck, ShieldOff } from "lucide-react";
import { RANKS, rankIndexForRating } from "@/lib/ranks";

type Section = { startMs: number; endMs: number; strain: number; nps: number; jumpness: number; direction: number; distance: number; pattern: string };
type PatternSegment = { startMs: number; endMs: number; pattern: string; averageStrain: number; peakStrain: number; averageNps: number; jumpness: number; direction: number; distance: number };
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
  patternSegments: PatternSegment[];
  error: string | null;
};
type MapRow = { id: string; title: string; artist: string | null; mapperName: string | null; imageUrl: string | null; rating: number | null; noteCount: number | null; length: number | null; sourceBeatmapId: number | null; sourceUrl: string | null; sourceStatus: string; analysisStatus: string; analysis: Analysis | null };
type Catalog = { maps: MapRow[]; page: number; pageSize: number; total: number; pages: number; analyzerVersion: number };
type AnalyzerStats = { total: number; analyzed: number; failed: number; pending: number };

function formatSeconds(milliseconds: number | null) { return milliseconds == null ? "—" : `${Math.round(milliseconds / 1000)}s`; }
function formatSectionTime(milliseconds: number) { const seconds = Math.max(0, Math.round(milliseconds / 1000)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }
function value(value: number | null, digits = 2) { return value == null ? "—" : value.toFixed(digits); }

export function MapAnalysisManager() {
  const [source, setSource] = useState("all");
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [stats, setStats] = useState<AnalyzerStats | null>(null);
  const [busyId, setBusyId] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [expandedId, setExpandedId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const params = new URLSearchParams({ source, page: String(page) });
    if (appliedQuery) params.set("q", appliedQuery);
    try {
      const [catalogResponse, statsResponse] = await Promise.all([
        fetch(`/api/admin/maps/catalog?${params.toString()}`, { cache: "no-store" }),
        fetch("/api/admin/maps/analyze-ranked", { cache: "no-store" }),
      ]);
      const data = await catalogResponse.json();
      const statsData = await statsResponse.json();
      if (!catalogResponse.ok) throw new Error(data.error ?? "Could not load map catalog.");
      setCatalog(data);
      if (statsResponse.ok) setStats(statsData.stats ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load map catalog.");
    }
  }, [source, page, appliedQuery]);

  useEffect(() => { void load(); }, [load]);

  async function analyze(id: string) {
    setBusyId(id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/maps/${id}/analyze`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Map analysis failed.");
      setMessage(`Analysis complete. Recalculated ${data.recalculatedUsers ?? 0} affected player${data.recalculatedUsers === 1 ? "" : "s"}.`);
      await load();
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "Map analysis failed.");
      await load();
    } finally {
      setBusyId("");
    }
  }

  async function analyzeAllRanked() {
    if (bulkBusy) return;
    setBulkBusy(true);
    setError("");
    setMessage("");
    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    let recalculatedUsers = 0;
    try {
      for (;;) {
        const response = await fetch("/api/admin/maps/analyze-ranked", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 3 }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Ranked map analysis failed.");
        processed += data.processed ?? 0;
        succeeded += data.succeeded ?? 0;
        failed += data.failed ?? 0;
        recalculatedUsers += data.recalculatedUsers ?? 0;
        setStats(data.stats ?? null);
        setMessage(`Analyzer v${catalog?.analyzerVersion ?? "current"}: ${data.stats?.analyzed ?? succeeded}/${data.stats?.total ?? "?"} current · ${data.stats?.pending ?? 0} pending · ${data.stats?.failed ?? failed} failed.`);
        if (!data.processed || !data.stats?.pending) break;
      }
      setMessage(`Ranked analysis pass complete: ${succeeded} analyzed, ${failed} failed, ${processed} processed, ${recalculatedUsers} affected player recalculations. Failed maps remain non-earnable until they analyze successfully.`);
      await load();
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "Ranked map analysis failed.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function setEligible(id: string, pointEligible: boolean) {
    setBusyId(id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/maps/${id}/eligibility`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pointEligible }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not update point eligibility.");
      setMessage(`${pointEligible ? "Enabled" : "Disabled"} RPL/RPV/RPS earning for this map. Recalculated ${data.recalculatedUsers ?? 0} affected player${data.recalculatedUsers === 1 ? "" : "s"}.`);
      await load();
    } catch (eligibilityError) {
      setError(eligibilityError instanceof Error ? eligibilityError.message : "Could not update point eligibility.");
    } finally {
      setBusyId("");
    }
  }

  return <section className="ui-panel ui-panel-compact sm:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="ui-eyebrow">Difficulty analyzer</p><h2 className="mt-2 text-2xl font-semibold text-white">Ranked map catalog</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Ratings use raw note timing and positions. Each 1.5-second section weighs relative NPS, movement distance, direction changes, stacks and stream/jump character; the map then combines peak, sustained and active section strain plus break-aware stamina. Rhythia stars do not determine ranked difficulty.</p></div>
      <div className="flex gap-2"><div className="rounded-2xl border border-border bg-background/60 px-4 py-3 text-right"><p className="text-xs text-muted">Analyzer</p><p className="mt-1 font-semibold text-white">v{catalog?.analyzerVersion ?? "—"}</p></div>{stats && <div className="rounded-2xl border border-border bg-background/60 px-4 py-3 text-right"><p className="text-xs text-muted">Ranked coverage</p><p className="mt-1 font-semibold text-white">{stats.analyzed}/{stats.total}</p><p className="text-xs text-muted">{stats.pending} pending · {stats.failed} failed</p></div>}</div>
    </div>

    <div className="mt-6 flex flex-col gap-3 lg:flex-row">
      <div className="flex flex-wrap gap-2">{["all", "ranked", "unranked", "legacy"].map((item) => <button key={item} type="button" onClick={() => { setSource(item); setPage(1); }} className={`rounded-full border px-4 py-2 text-xs font-semibold capitalize ${source === item ? "border-accent bg-accent/15 text-white" : "border-border text-muted hover:text-white"}`}>{item}</button>)}</div>
      <form onSubmit={(event) => { event.preventDefault(); setAppliedQuery(query.trim()); setPage(1); }} className="flex min-w-0 flex-1 gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title or mapper" className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-2 text-sm text-white outline-none focus:border-accent"/><button className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"><Search size={15}/>Search</button></form>
      <button type="button" disabled={bulkBusy} onClick={() => void analyzeAllRanked()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Activity size={15}/>{bulkBusy ? "Analyzing ranked…" : stats?.pending ? `Analyze all ranked (${stats.pending})` : "Verify ranked analysis"}</button>
      <button type="button" onClick={() => void load()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-white"><RefreshCw size={15}/>Refresh</button>
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
            <button type="button" onClick={() => setExpandedId(expanded ? "" : map.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <ChevronDown size={16} className={`shrink-0 text-muted transition ${expanded ? "rotate-180" : ""}`}/>
              {map.imageUrl ? <img src={map.imageUrl} alt="" className="h-14 w-24 shrink-0 rounded-xl object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }}/> : <div className="h-14 w-24 shrink-0 rounded-xl border border-border bg-black/20"/>}
              <div className="min-w-0"><p className="truncate font-semibold text-white">{map.title}</p><p className="mt-1 truncate text-xs text-muted">{map.artist ?? "Unknown artist"} · {map.mapperName ?? "Unknown mapper"} · {map.noteCount?.toLocaleString() ?? "—"} notes</p></div>
            </button>
            <div className="flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full border border-border px-3 py-1 capitalize text-muted">{map.sourceStatus}</span><span className={`rounded-full border px-3 py-1 capitalize ${current ? "border-emerald-400/30 text-emerald-300" : map.analysisStatus === "failed" ? "border-red-400/30 text-red-300" : "border-amber-400/30 text-amber-300"}`}>{map.analysisStatus}</span>{rank && <span className="rounded-full border border-border px-3 py-1 text-white">{rank.name} · {map.rating?.toFixed(2)}</span>}{analysis?.pointEligible ? <span className="rounded-full border border-cyan-400/30 px-3 py-1 text-cyan-200">RPL/RPV/RPS enabled</span> : null}</div>
            <div className="flex flex-wrap gap-2"><button type="button" disabled={busyId === map.id} onClick={() => void analyze(map.id)} className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"><Activity size={14}/>{busyId === map.id ? "Working…" : current ? "Analyze again" : "Analyze"}</button>{current && analysis ? <button type="button" disabled={busyId === map.id} onClick={() => void setEligible(map.id, !analysis.pointEligible)} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{analysis.pointEligible ? <ShieldOff size={14}/> : <ShieldCheck size={14}/>} {analysis.pointEligible ? "Disable points" : "Enable RPL/RPV/RPS"}</button> : null}</div>
          </div>

          {expanded ? <div className="border-t border-border p-4">
            {!analysis ? <p className="text-sm text-muted">This map has not been analyzed yet.</p> : <div className="space-y-5">
              {analysis.error ? <p className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{analysis.error}</p> : null}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">{[
                ["Rating", value(analysis.rating)], ["Direction", value(analysis.directionScore)], ["Distance", value(analysis.distanceScore)], ["Relative NPS", value(analysis.npsScore)],
                ["Stamina", analysis.staminaIndex == null ? "—" : `${Math.round(analysis.staminaIndex * 100)}%`], ["Jump ratio", analysis.jumpRatio == null ? "—" : `${Math.round(analysis.jumpRatio * 100)}%`],
                ["Peak jump NPS", value(analysis.peakJumpNps)], ["Peak stream NPS", value(analysis.peakStreamNps)], ["Active time", formatSeconds(analysis.activeDurationMs)], ["Longest hard", formatSeconds(analysis.longestHardSectionMs)],
                ["RPL", analysis.rpl?.toLocaleString() ?? "—"], ["RPV / RPS", `${analysis.rpv?.toLocaleString() ?? "—"} / ${analysis.rps?.toLocaleString() ?? "—"}`],
              ].map(([label, item]) => <div key={label} className="rounded-xl border border-border bg-black/15 p-3"><p className="text-xs uppercase tracking-[0.16em] text-muted">{label}</p><p className="mt-1 font-semibold text-white">{item}</p></div>)}</div>

              {analysis.patternSegments?.length ? <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Full pattern timeline</p><div className="mt-2 overflow-x-auto"><table className="w-full min-w-[820px] text-left text-xs"><thead className="text-muted"><tr><th className="pb-2">Time</th><th className="pb-2">Pattern</th><th className="pb-2">NPS</th><th className="pb-2">Avg strain</th><th className="pb-2">Peak strain</th><th className="pb-2">Jump</th><th className="pb-2">Direction</th><th className="pb-2">Distance</th></tr></thead><tbody>{analysis.patternSegments.map((segment, index) => <tr key={`${segment.startMs}-${index}`} className="border-t border-border text-white"><td className="py-2">{formatSectionTime(segment.startMs)}–{formatSectionTime(segment.endMs)}</td><td className="py-2 capitalize">{segment.pattern.replace("-", " ")}</td><td className="py-2">{segment.averageNps.toFixed(2)}</td><td className="py-2">{segment.averageStrain.toFixed(2)}</td><td className="py-2">{segment.peakStrain.toFixed(2)}</td><td className="py-2">{segment.jumpness.toFixed(2)}</td><td className="py-2">{segment.direction.toFixed(2)}</td><td className="py-2">{segment.distance.toFixed(2)}</td></tr>)}</tbody></table></div></div> : null}

              {analysis.topSections?.length ? <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Hardest sections</p><div className="mt-2 grid gap-2 md:grid-cols-2">{analysis.topSections.map((section, index) => <div key={`${section.startMs}-${index}`} className="rounded-xl border border-border bg-black/15 p-3 text-xs text-muted"><div className="flex items-center justify-between gap-3"><span className="font-semibold capitalize text-white">{section.pattern.replace("-", " ")}</span><span>{formatSectionTime(section.startMs)}–{formatSectionTime(section.endMs)}</span></div><p className="mt-2">Strain {section.strain.toFixed(2)} · {section.nps.toFixed(2)} NPS · jump {section.jumpness.toFixed(2)} · direction {section.direction.toFixed(2)}</p></div>)}</div></div> : null}
            </div>}
          </div> : null}
        </div>;
      })}
      {catalog && catalog.maps.length === 0 ? <p className="rounded-2xl border border-border bg-background/40 p-6 text-center text-sm text-muted">No maps match this filter.</p> : null}
    </div>

    {catalog ? <div className="mt-5 flex items-center justify-between gap-3"><p className="text-xs text-muted">{catalog.total.toLocaleString()} maps · 10 per page · page {catalog.page} of {catalog.pages}</p><div className="flex gap-2"><button type="button" disabled={catalog.page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-xl border border-border p-2 text-white disabled:opacity-30"><ChevronLeft size={16}/></button><button type="button" disabled={catalog.page >= catalog.pages} onClick={() => setPage((current) => Math.min(catalog.pages, current + 1))} className="rounded-xl border border-border p-2 text-white disabled:opacity-30"><ChevronRight size={16}/></button></div></div> : null}
  </section>;
}
