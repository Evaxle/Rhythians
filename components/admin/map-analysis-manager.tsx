"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, RefreshCw, Search, ShieldCheck, ShieldOff } from "lucide-react";
import { RANKS, rankIndexForRating } from "@/lib/ranks";

type Section = { startMs: number; endMs: number; strain: number; nps: number; jumpness: number; direction: number; distance: number; pattern: string };
type PatternSegment = { startMs: number; endMs: number; pattern: string; averageStrain: number; peakStrain: number; averageNps: number; jumpness: number; direction: number; distance: number };
type Metric = { key: string; label: string; score: number; detail: string };
type Issue = { type: string; severity: number; startMs: number; endMs: number; title: string; detail: string };
type PatternProfile = { streamRatio: number; jumpRatio: number; techRatio: number; vibroRatio: number; quantumRatio: number; offGridRatio: number };
type Analysis = {
  analyzerVersion: number;
  rankabilityVersion: number;
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
  jumpRatio: number | null;
  rpl: number | null;
  rpv: number | null;
  rps: number | null;
  topSections: Section[];
  patternSegments: PatternSegment[];
  rankabilityScore: number | null;
  rankabilityColor: string | null;
  rankabilityLabel: string | null;
  rankabilitySummary: string | null;
  rankabilityMetrics: Metric[];
  rankabilityIssues: Issue[];
  patternProfile: PatternProfile | null;
  error: string | null;
};
type MapRow = { id: string; title: string; artist: string | null; mapperName: string | null; imageUrl: string | null; rating: number | null; noteCount: number | null; length: number | null; sourceBeatmapId: number | null; sourceUrl: string | null; sourceStatus: string; analysisStatus: string; analysis: Analysis | null };
type QueueStats = { total: number; analyzed: number; failed: number; pending: number; green: number; yellow: number; orange: number; red: number };
type Catalog = { maps: MapRow[]; page: number; pageSize: number; total: number; pages: number; analyzerVersion: number; rankabilityVersion: number; minimumPointRankability: number; queueStats: QueueStats };
type AnalyzerStats = { total: number; analyzed: number; failed: number; pending: number; rankable?: number };

function time(milliseconds: number) { const seconds = Math.max(0, Math.round(milliseconds / 1000)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }
function value(number: number | null, digits = 2) { return number == null ? "—" : number.toFixed(digits); }
function scoreTheme(color: string | null) {
  if (color === "green") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (color === "yellow") return "border-yellow-400/30 bg-yellow-400/10 text-yellow-200";
  if (color === "orange") return "border-orange-400/30 bg-orange-400/10 text-orange-200";
  return "border-red-400/30 bg-red-400/10 text-red-200";
}

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
      const [catalogResponse, statsResponse] = await Promise.all([fetch(`/api/admin/maps/catalog?${params.toString()}`, { cache: "no-store" }), fetch("/api/admin/maps/analyze-ranked", { cache: "no-store" })]);
      const data = await catalogResponse.json();
      const statsData = await statsResponse.json();
      if (!catalogResponse.ok) throw new Error(data.error ?? "Could not load map catalog.");
      setCatalog(data);
      if (statsResponse.ok) setStats(statsData.stats ?? null);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Could not load map catalog."); }
  }, [source, page, appliedQuery]);

  useEffect(() => { void load(); }, [load]);

  async function analyze(id: string) {
    setBusyId(id); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/maps/${id}/analyze`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Map analysis failed.");
      setMessage(`Difficulty + rankability analysis complete. Recalculated ${data.recalculatedUsers ?? 0} affected players.`);
      await load();
    } catch (analysisError) { setError(analysisError instanceof Error ? analysisError.message : "Map analysis failed."); await load(); }
    finally { setBusyId(""); }
  }

  async function analyzeAllRanked() {
    if (bulkBusy) return;
    setBulkBusy(true); setError(""); setMessage("");
    let succeeded = 0, failed = 0, processed = 0;
    try {
      for (;;) {
        const response = await fetch("/api/admin/maps/analyze-ranked", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 5 }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Ranked map analysis failed.");
        succeeded += data.succeeded ?? 0; failed += data.failed ?? 0; processed += data.processed ?? 0; setStats(data.stats ?? null);
        setMessage(`Ranked review: ${data.stats?.analyzed ?? succeeded}/${data.stats?.total ?? "?"} current · ${data.stats?.rankable ?? "?"} at 4.00+ · ${data.stats?.pending ?? 0} pending.`);
        if (!data.processed || !data.stats?.pending) break;
      }
      setMessage(`Ranked re-analysis finished: ${succeeded} successful, ${failed} failed, ${processed} processed.`);
      await load();
    } catch (analysisError) { setError(analysisError instanceof Error ? analysisError.message : "Ranked map analysis failed."); }
    finally { setBulkBusy(false); }
  }

  async function setEligible(id: string, pointEligible: boolean) {
    setBusyId(id); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/maps/${id}/eligibility`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pointEligible }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not update point eligibility.");
      setMessage(`${pointEligible ? "Enabled" : "Disabled"} RPL/RPV/RPS earning. ${data.recalculatedUsers ?? 0} affected players recalculated.`);
      await load();
    } catch (eligibilityError) { setError(eligibilityError instanceof Error ? eligibilityError.message : "Could not update point eligibility."); }
    finally { setBusyId(""); }
  }

  const queue = catalog?.queueStats;
  return <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow sm:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm uppercase tracking-[0.3em] text-accent">Map analysis</p><h2 className="mt-2 text-2xl font-semibold text-white">Difficulty + rankability</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Difficulty measures raw challenge. Rankability measures whether that challenge is clean enough for competitive points: grid timing, NPS consistency, readable direction changes, spacing, quantum control, difficulty spikes, vibro consistency and pattern coherence. Ranked and Legacy maps require at least <strong className="text-white">4.00/5</strong> before points can be enabled.</p></div><div className="flex flex-wrap gap-2"><div className="rounded-2xl border border-border bg-background/60 px-4 py-3 text-right"><p className="text-xs text-muted">Difficulty / quality</p><p className="mt-1 font-semibold text-white">v{catalog?.analyzerVersion ?? "—"} / v{catalog?.rankabilityVersion ?? "—"}</p></div>{stats && <div className="rounded-2xl border border-border bg-background/60 px-4 py-3 text-right"><p className="text-xs text-muted">Ranked coverage</p><p className="mt-1 font-semibold text-white">{stats.analyzed}/{stats.total}</p><p className="text-[10px] text-muted">{stats.rankable ?? 0} rankable · {stats.pending} pending</p></div>}</div></div>
    {queue && <div className="mt-5 grid gap-2 sm:grid-cols-3 lg:grid-cols-7">{[["All maps",queue.total],["Analyzed",queue.analyzed],["Pending",queue.pending],["Green 4–5",queue.green],["Yellow 3",queue.yellow],["Orange 2",queue.orange],["Red 1",queue.red]].map(([label,count]) => <div key={String(label)} className="rounded-xl border border-border bg-background/50 p-3"><p className="text-[10px] uppercase tracking-wide text-muted">{label}</p><p className="mt-1 font-bold text-white">{count}</p></div>)}</div>}
    <div className="mt-6 flex flex-col gap-3 lg:flex-row"><div className="flex flex-wrap gap-2">{["all","ranked","unranked","legacy"].map((item) => <button key={item} type="button" onClick={() => { setSource(item); setPage(1); }} className={`rounded-full border px-4 py-2 text-xs font-semibold capitalize ${source === item ? "border-accent bg-accent/15 text-white" : "border-border text-muted hover:text-white"}`}>{item}</button>)}</div><form onSubmit={(event) => { event.preventDefault(); setAppliedQuery(query.trim()); setPage(1); }} className="flex min-w-0 flex-1 gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title or mapper" className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-2 text-sm text-white outline-none focus:border-accent"/><button className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"><Search size={15}/>Search</button></form><button type="button" disabled={bulkBusy} onClick={() => void analyzeAllRanked()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Activity size={15}/>{bulkBusy ? "Reviewing ranked…" : stats?.pending ? `Re-analyze ranked (${stats.pending})` : "Verify ranked"}</button><button type="button" onClick={() => void load()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-white"><RefreshCw size={15}/>Refresh</button></div>
    <p className="mt-3 text-xs text-muted">The automatic worker claims up to 5 maps every minute without duplicate processing. When the backlog is empty it periodically refreshes Rhythia so new Ranked, Legacy and Unranked uploads enter the queue.</p>
    {error && <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}{message && <p className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">{message}</p>}

    <div className="mt-6 space-y-3">{catalog?.maps.map((map) => {
      const analysis = map.analysis;
      const current = map.analysisStatus === "analyzed" && analysis?.analyzerVersion === catalog.analyzerVersion && analysis?.rankabilityVersion === catalog.rankabilityVersion;
      const rank = map.rating == null ? null : RANKS[rankIndexForRating(map.rating)];
      const expanded = expandedId === map.id;
      const canEarn = current && map.sourceStatus !== "unranked" && (analysis?.rankabilityScore ?? 0) >= catalog.minimumPointRankability;
      return <div key={map.id} className="overflow-hidden rounded-2xl border border-border bg-background/50">
        <div className="flex flex-col gap-4 p-4 xl:flex-row xl:items-center"><button type="button" onClick={() => setExpandedId(expanded ? "" : map.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><ChevronDown size={16} className={`shrink-0 text-muted transition ${expanded ? "rotate-180" : ""}`}/>{map.imageUrl ? <img src={map.imageUrl} alt="" className="h-14 w-24 shrink-0 rounded-xl object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }}/> : <div className="h-14 w-24 shrink-0 rounded-xl border border-border bg-black/20"/>}<div className="min-w-0"><p className="truncate font-semibold text-white">{map.title}</p><p className="mt-1 truncate text-xs text-muted">{map.artist ?? "Unknown artist"} · {map.mapperName ?? "Unknown mapper"} · {map.noteCount?.toLocaleString() ?? "—"} notes</p></div></button><div className="flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full border border-border px-3 py-1 capitalize text-muted">{map.sourceStatus}</span><span className={`rounded-full border px-3 py-1 capitalize ${current ? "border-emerald-400/30 text-emerald-300" : map.analysisStatus === "failed" ? "border-red-400/30 text-red-300" : "border-amber-400/30 text-amber-300"}`}>{map.analysisStatus}</span>{rank && <span className="rounded-full border border-border px-3 py-1 text-white">{rank.name} · {map.rating?.toFixed(2)}</span>}{analysis?.rankabilityScore != null && <span className={`rounded-full border px-3 py-1 ${scoreTheme(analysis.rankabilityColor)}`}>Rankability {analysis.rankabilityScore.toFixed(2)}/5</span>}{analysis?.pointEligible && <span className="rounded-full border border-cyan-400/30 px-3 py-1 text-cyan-200">Points enabled</span>}</div><div className="flex flex-wrap gap-2"><button type="button" disabled={busyId === map.id} onClick={() => void analyze(map.id)} className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"><Activity size={14}/>{busyId === map.id ? "Working…" : current ? "Analyze again" : "Analyze"}</button>{current && analysis && map.sourceStatus !== "unranked" && <button type="button" disabled={busyId === map.id || (!analysis.pointEligible && !canEarn)} title={!analysis.pointEligible && !canEarn ? `Requires ${catalog.minimumPointRankability.toFixed(2)}/5 rankability` : undefined} onClick={() => void setEligible(map.id, !analysis.pointEligible)} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">{analysis.pointEligible ? <ShieldOff size={14}/> : <ShieldCheck size={14}/>} {analysis.pointEligible ? "Disable points" : "Enable points"}</button>}</div></div>
        {expanded && <div className="border-t border-border p-4">{!analysis ? <p className="text-sm text-muted">This map has not been analyzed yet.</p> : <div className="space-y-5">{analysis.error && <p className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{analysis.error}</p>}<div className={`rounded-2xl border p-4 ${scoreTheme(analysis.rankabilityColor)}`}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em]">Rankability</p><p className="mt-1 text-2xl font-black text-white">{analysis.rankabilityScore?.toFixed(2) ?? "—"}/5 · {analysis.rankabilityLabel ?? "Pending"}</p></div><p className="max-w-2xl text-xs leading-5 text-white/80">{analysis.rankabilitySummary ?? "Run the current analyzer to generate competitive-quality feedback."}</p></div></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{analysis.rankabilityMetrics?.map((metric) => <div key={metric.key} className="rounded-xl border border-border bg-black/15 p-3"><div className="flex justify-between gap-2"><p className="text-xs font-semibold text-white">{metric.label}</p><span className="text-xs font-bold text-white">{Math.round(metric.score * 100)}%</span></div><p className="mt-2 text-[11px] leading-5 text-muted">{metric.detail}</p></div>)}</div>
          {analysis.rankabilityIssues?.length ? <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Flagged mapper feedback</p><div className="mt-2 grid gap-2 lg:grid-cols-2">{analysis.rankabilityIssues.slice(0, 10).map((entry,index) => <div key={`${entry.type}-${index}`} className="rounded-xl border border-orange-400/20 bg-orange-400/[0.05] p-3"><div className="flex items-center justify-between gap-3"><p className="flex items-center gap-2 text-xs font-semibold text-white"><AlertTriangle size={13}/>{entry.title}</p><span className="text-[10px] text-muted">{time(entry.startMs)}–{time(entry.endMs)}</span></div><p className="mt-1 text-[11px] leading-5 text-muted">{entry.detail}</p></div>)}</div></div> : null}
          {analysis.patternProfile && <div className="flex flex-wrap gap-2 text-[11px] text-muted">{Object.entries(analysis.patternProfile).map(([key,ratio]) => <span key={key} className="rounded-full border border-border px-3 py-1.5"><strong className="text-white">{Math.round(Number(ratio) * 100)}%</strong> {key.replace("Ratio","")}</span>)}</div>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">{[["Difficulty",value(analysis.rating)],["Direction",value(analysis.directionScore)],["Distance",value(analysis.distanceScore)],["Relative NPS",value(analysis.npsScore)],["Stamina",analysis.staminaIndex == null ? "—" : `${Math.round(analysis.staminaIndex * 100)}%`],["Jump ratio",analysis.jumpRatio == null ? "—" : `${Math.round(analysis.jumpRatio * 100)}%`],["RPL",analysis.rpl?.toLocaleString() ?? "—"],["RPV",analysis.rpv?.toLocaleString() ?? "—"],["RPS",analysis.rps?.toLocaleString() ?? "—"]].map(([label,item]) => <div key={String(label)} className="rounded-xl border border-border bg-black/15 p-3"><p className="text-[10px] uppercase tracking-[0.16em] text-muted">{label}</p><p className="mt-1 font-semibold text-white">{item}</p></div>)}</div>
        </div>}</div>}
      </div>;
    })}</div>
    {catalog && <div className="mt-6 flex items-center justify-between gap-3"><button disabled={catalog.page <= 1} onClick={() => setPage((current) => Math.max(1,current-1))} className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs text-white disabled:opacity-30"><ChevronLeft size={14}/>Previous</button><span className="text-xs text-muted">Page {catalog.page} of {catalog.pages} · {catalog.total.toLocaleString()} maps</span><button disabled={catalog.page >= catalog.pages} onClick={() => setPage((current) => current+1)} className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs text-white disabled:opacity-30">Next<ChevronRight size={14}/></button></div>}
  </section>;
}
