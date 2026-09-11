"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, ChevronLeft, ChevronRight, RefreshCw, RotateCcw, Search, ShieldCheck, ShieldOff } from "lucide-react";

type Source = "all" | "ranked" | "unranked" | "legacy";
type Stats = { total: number; analyzed: number; failed: number; pending: number; analyzerVersion: number; source: Source };
type Factor = { key: string; label: string; score: number; reason: string };
type Rankability = { version: number; score: number; confidence: number; verdict: string; summary: string; factors: Factor[]; limitations: string[] };
type Details = {
  coreDifficulty: number;
  sustainedDifficulty: number;
  peakDifficulty: number;
  movementPressure: number;
  directionPressure: number;
  distancePressure: number;
  timingPressure: number;
  jumpPressure: number;
  streamPressure: number;
  techPressure: number;
  cheeseRatio: number;
  activeDuty: number;
  recoveryRatio: number;
  difficultyConsistency: number;
  coverage: { easy: number; moderate: number; hard: number; peak: number };
  windows: { micro: number; short: number; medium: number; long: number };
};
type Analysis = { analyzerVersion: number; status: string; pointEligible: boolean; analysisDetails: Details | null };
type Fit = { category: string; label: string; score: number; suggestedLevel: number; reason: string };
type Row = {
  id: string;
  title: string;
  artist: string | null;
  mapperName: string | null;
  imageUrl: string | null;
  rating: number | null;
  sourceStatus: "ranked" | "unranked" | "legacy";
  analysisStatus: string;
  analysis: Analysis | null;
  rankability: Rankability | null;
  challengeFits: Fit[];
};
type Catalog = { maps: Row[]; page: number; pages: number; total: number; analyzerVersion: number; rankabilityVersion: number; challengeFitVersion: number };
type ErrorResponse = { error?: string };
type StatsResponse = ErrorResponse & { stats?: Stats };
type SingleAnalysisResponse = ErrorResponse & { recalculatedUsers?: number };
type BulkAnalysisResponse = ErrorResponse & {
  processed: number;
  succeeded: number;
  failed: number;
  recalculatedUsers: number;
  nextCursor: string | null;
  done: boolean;
  stats: Stats;
};
type EligibilityResponse = ErrorResponse & { pointEligible?: boolean };

const sourceOptions: Array<[Source, string]> = [["all", "All"], ["ranked", "Ranked"], ["unranked", "Unranked"], ["legacy", "Legacy"]];
const pct = (value: number | undefined | null) => `${Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 100)}%`;
const num = (value: number | undefined | null) => Number.isFinite(Number(value)) ? Number(value).toFixed(2) : "—";

async function readJson<T>(response: Response): Promise<T> {
  return await response.json() as T;
}

export function RankabilityV5Manager() {
  const [source, setSource] = useState<Source>("all");
  const [query, setQuery] = useState("");
  const [applied, setApplied] = useState("");
  const [page, setPage] = useState(1);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [stats, setStats] = useState<Record<Exclude<Source, "all">, Stats | null>>({ ranked: null, unranked: null, legacy: null });
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const params = new URLSearchParams({ source, page: String(page) });
    if (applied) params.set("q", applied);

    try {
      const responses: [Response, Response, Response, Response] = await Promise.all([
        fetch(`/api/admin/maps/catalog?${params}`, { cache: "no-store" }),
        fetch("/api/admin/maps/analyze-ranked?source=ranked", { cache: "no-store" }),
        fetch("/api/admin/maps/analyze-ranked?source=unranked", { cache: "no-store" }),
        fetch("/api/admin/maps/analyze-ranked?source=legacy", { cache: "no-store" }),
      ]);
      const [catalogResponse, rankedResponse, unrankedResponse, legacyResponse] = responses;
      const catalogData = await readJson<Catalog & ErrorResponse>(catalogResponse);
      if (!catalogResponse.ok) throw new Error(catalogData.error ?? "Could not load map catalog.");
      setCatalog(catalogData);

      const nextStats: Record<Exclude<Source, "all">, Stats | null> = { ranked: null, unranked: null, legacy: null };
      const statResponses: Array<[Exclude<Source, "all">, Response]> = [
        ["ranked", rankedResponse],
        ["unranked", unrankedResponse],
        ["legacy", legacyResponse],
      ];
      for (const [key, response] of statResponses) {
        if (!response.ok) continue;
        const data = await readJson<StatsResponse>(response);
        nextStats[key] = data.stats ?? null;
      }
      setStats(nextStats);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load map catalog.");
    }
  }, [source, page, applied]);

  useEffect(() => { void load(); }, [load]);

  async function analyzeOne(id: string) {
    setBusy(id);
    setError("");
    try {
      const response: Response = await fetch(`/api/admin/maps/${id}/analyze`, { method: "POST" });
      const data = await readJson<SingleAnalysisResponse>(response);
      if (!response.ok) throw new Error(data.error ?? "Analysis failed.");
      setMessage(`Rebuilt Difficulty v5, Rankability v5, and Challenge Fit v2. Recalculated ${data.recalculatedUsers ?? 0} affected players.`);
      await load();
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "Analysis failed.");
    } finally {
      setBusy("");
    }
  }

  async function analyzePending(target: Exclude<Source, "all">) {
    if (busy) return;
    setBusy(`pending:${target}`);
    setError("");
    let succeeded = 0;
    let failed = 0;
    try {
      for (;;) {
        const response: Response = await fetch("/api/admin/maps/analyze-ranked", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: target, limit: 2 }),
        });
        const data = await readJson<BulkAnalysisResponse>(response);
        if (!response.ok) throw new Error(data.error ?? "Analysis failed.");
        succeeded += data.succeeded ?? 0;
        failed += data.failed ?? 0;
        setMessage(`${target}: ${data.stats?.analyzed ?? succeeded}/${data.stats?.total ?? "?"} current · ${data.stats?.pending ?? 0} pending · ${data.stats?.failed ?? failed} failed.`);
        if (!data.processed || !data.stats?.pending) break;
      }
      await load();
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "Analysis failed.");
    } finally {
      setBusy("");
    }
  }

  async function forceRanked() {
    if (busy || !window.confirm("Re-analyze every ranked map from raw map data with the newest analyzer suite?")) return;
    setBusy("force");
    setError("");
    let cursor: string | null = null;
    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    let recalculatedUsers = 0;

    try {
      for (;;) {
        const response: Response = await fetch("/api/admin/maps/analyze-ranked", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: "ranked", limit: 2, force: true, cursor }),
        });
        const data: BulkAnalysisResponse = await readJson<BulkAnalysisResponse>(response);
        if (!response.ok) throw new Error(data.error ?? "Full rebuild failed.");

        processed += data.processed ?? 0;
        succeeded += data.succeeded ?? 0;
        failed += data.failed ?? 0;
        recalculatedUsers += data.recalculatedUsers ?? 0;
        const nextCursor: string | null = typeof data.nextCursor === "string" && data.nextCursor.length > 0 ? data.nextCursor : null;
        cursor = nextCursor;

        setMessage(`Full ranked rebuild: ${processed}/${data.stats?.total ?? "?"} processed · ${succeeded} rebuilt · ${failed} failed · ${recalculatedUsers} player recalculations.`);
        if (!data.processed || data.done || nextCursor === null) break;
      }

      setMessage(`Full ranked rebuild complete: ${succeeded} rebuilt from raw map data, ${failed} failed, ${recalculatedUsers} player recalculations.`);
      await load();
    } catch (rebuildError) {
      setError(rebuildError instanceof Error ? rebuildError.message : "Full rebuild failed.");
    } finally {
      setBusy("");
    }
  }

  async function togglePoints(row: Row) {
    if (!row.analysis) return;
    setBusy(row.id);
    setError("");
    try {
      const response: Response = await fetch(`/api/admin/maps/${row.id}/eligibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pointEligible: !row.analysis.pointEligible }),
      });
      const data = await readJson<EligibilityResponse>(response);
      if (!response.ok) throw new Error(data.error ?? "Could not update eligibility.");
      await load();
    } catch (eligibilityError) {
      setError(eligibilityError instanceof Error ? eligibilityError.message : "Could not update eligibility.");
    } finally {
      setBusy("");
    }
  }

  return <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow sm:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm uppercase tracking-[0.3em] text-accent">Whole-map analyzer suite</p><h2 className="mt-2 text-2xl font-semibold text-white">Difficulty v5 · Rankability v5 · Challenge Fit v2</h2><p className="mt-2 max-w-5xl text-sm leading-6 text-muted">Reads SSPM/RHM/JSON/text note data directly. Timing, three-note direction, logistic spacing, local NPS, bursts, sustained windows, recovery, stamina, pattern recurrence and anti-cheese behavior are evaluated before the final ratings.</p></div><div className="rounded-2xl border border-accent/25 bg-accent/10 px-4 py-3 text-right"><p className="text-xs text-muted">Versions</p><p className="font-bold text-white">D{catalog?.analyzerVersion ?? 5} · R{catalog?.rankabilityVersion ?? 5} · C{catalog?.challengeFitVersion ?? 2}</p></div></div>
    <div className="mt-5 grid gap-3 md:grid-cols-3">{(["ranked", "unranked", "legacy"] as const).map(key => { const current = stats[key]; return <div key={key} className="rounded-2xl border border-border bg-background/55 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase text-muted">{key}</p><p className="mt-1 text-lg font-semibold text-white">{current ? `${current.analyzed}/${current.total}` : "—"}</p><p className="text-[11px] text-muted">{current ? `${current.pending} pending · ${current.failed} failed` : "Loading…"}</p></div><button disabled={Boolean(busy)} onClick={() => void analyzePending(key)} className="rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{busy === `pending:${key}` ? "Analyzing…" : "Analyze pending"}</button></div></div>; })}</div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] p-4"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-200">Full ranked rebuild</p><p className="mt-1 text-xs text-muted">Forces every ranked map through the newest raw-data analyzer, including maps already marked current.</p></div><button disabled={Boolean(busy)} onClick={() => void forceRanked()} className="inline-flex items-center gap-2 rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-2.5 text-xs font-bold text-amber-100 disabled:opacity-40"><RotateCcw size={15}/>{busy === "force" ? "Re-analyzing all ranked…" : "Re-analyze ALL ranked with latest"}</button></div>
    <div className="mt-6 flex flex-col gap-3 lg:flex-row"><div className="flex flex-wrap gap-2">{sourceOptions.map(([key, label]) => <button key={key} onClick={() => { setSource(key); setPage(1); }} className={`rounded-full border px-4 py-2 text-xs font-semibold ${source === key ? "border-accent bg-accent/15 text-white" : "border-border text-muted"}`}>{label}</button>)}</div><form onSubmit={event => { event.preventDefault(); setApplied(query.trim()); setPage(1); }} className="flex min-w-0 flex-1 gap-2"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search title, artist, or mapper" className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-2 text-sm text-white"/><button className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"><Search size={15}/>Search</button></form><button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm text-white"><RefreshCw size={15}/>Refresh</button></div>
    {error && <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}{message && <p className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">{message}</p>}
    <div className="mt-6 space-y-4">{catalog?.maps.map(row => { const details = row.analysis?.analysisDetails; const fits = [...(row.challengeFits ?? [])].sort((a, b) => b.score - a.score).slice(0, 3); return <article key={row.id} className="rounded-2xl border border-border bg-background/50 p-4"><div className="flex flex-col gap-4 xl:flex-row xl:items-start"><div className="flex min-w-0 flex-1 gap-3">{row.imageUrl ? <img src={row.imageUrl} alt="" className="h-16 w-28 rounded-xl object-cover"/> : <div className="h-16 w-28 rounded-xl border border-border"/>}<div className="min-w-0"><h3 className="truncate font-semibold text-white">{row.title}</h3><p className="text-xs text-muted">{row.artist ?? "Unknown artist"} · {row.mapperName ?? "Unknown mapper"}</p><div className="mt-2 flex gap-2 text-[10px]"><span className="rounded-full border border-border px-2 py-1 capitalize">{row.sourceStatus}</span><span className="rounded-full border border-border px-2 py-1">{row.analysisStatus}</span>{row.rating != null && <span className="rounded-full border border-border px-2 py-1">Difficulty {row.rating.toFixed(2)}</span>}</div></div></div><div className="rounded-2xl border border-accent/25 bg-accent/[0.08] p-4"><p className="text-[10px] uppercase text-muted">Rankability v{row.rankability?.version ?? 5}</p><p className="text-2xl font-black text-white">{row.rankability?.score.toFixed(2) ?? "—"} / 5</p><p className="text-xs text-accent">{row.rankability?.verdict ?? "Analyze to score"}</p></div><div className="flex flex-wrap gap-2"><button disabled={busy === row.id} onClick={() => void analyzeOne(row.id)} className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white"><Activity size={14}/>{busy === row.id ? "Working…" : "Analyze again"}</button>{row.sourceStatus === "ranked" && row.analysis && <button disabled={Boolean(busy)} onClick={() => void togglePoints(row)} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-xs text-white disabled:opacity-40">{row.analysis.pointEligible ? <ShieldOff size={14}/> : <ShieldCheck size={14}/>} {row.analysis.pointEligible ? "Disable points" : "Enable points"}</button>}</div></div>
      {details && <><div className="mt-4 grid gap-2 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">{[["Core", num(details.coreDifficulty)], ["Sustained", num(details.sustainedDifficulty)], ["Peak", num(details.peakDifficulty)], ["Movement", pct(details.movementPressure)], ["Direction", pct(details.directionPressure)], ["Distance", pct(details.distancePressure)], ["Timing", num(details.timingPressure)], ["Jump", num(details.jumpPressure)], ["Stream", num(details.streamPressure)], ["Tech", num(details.techPressure)], ["Anti-cheese", pct(1 - details.cheeseRatio)], ["Consistency", pct(details.difficultyConsistency)]].map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-black/10 p-3"><p className="text-[10px] uppercase text-muted">{label}</p><p className="mt-1 text-sm font-bold text-white">{value}</p></div>)}</div><div className="mt-3 rounded-xl border border-border bg-black/10 p-3 text-xs text-muted">Coverage: easy {pct(details.coverage.easy)} · moderate {pct(details.coverage.moderate)} · hard {pct(details.coverage.hard)} · peak {pct(details.coverage.peak)}. Windows: {num(details.windows.micro)} / {num(details.windows.short)} / {num(details.windows.medium)} / {num(details.windows.long)}. Active {pct(details.activeDuty)} · recovery {pct(details.recoveryRatio)}.</div></>}
      {fits.length > 0 && <div className="mt-3 grid gap-2 md:grid-cols-3">{fits.map(fit => <div key={fit.category} className="rounded-xl border border-cyan-400/20 bg-cyan-400/[0.05] p-3"><div className="flex justify-between"><p className="text-xs font-semibold text-white">{fit.label}</p><p className="text-xs font-black text-cyan-200">{fit.score.toFixed(2)}/5 · L{fit.suggestedLevel}</p></div><p className="mt-1 text-[10px] leading-4 text-muted">{fit.reason}</p></div>)}</div>}
      {row.rankability && <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">{row.rankability.factors.map(factor => <div key={factor.key} className="rounded-xl border border-border bg-black/10 p-3"><div className="flex justify-between"><p className="text-xs font-semibold text-white">{factor.label}</p><p className="text-xs font-black text-accent">{factor.score.toFixed(2)}/5</p></div><p className="mt-1 text-[10px] leading-4 text-muted">{factor.reason}</p></div>)}</div>}</article>; })}</div>
    {catalog && catalog.pages > 1 && <div className="mt-6 flex items-center justify-between"><button disabled={page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm text-white disabled:opacity-40"><ChevronLeft size={15}/>Previous</button><p className="text-xs text-muted">Page {catalog.page}/{catalog.pages} · {catalog.total} maps</p><button disabled={page >= catalog.pages} onClick={() => setPage(value => value + 1)} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm text-white disabled:opacity-40">Next<ChevronRight size={15}/></button></div>}
  </section>;
}
