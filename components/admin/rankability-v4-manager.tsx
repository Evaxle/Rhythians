"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, ChevronLeft, ChevronRight, RefreshCw, Search, ShieldCheck, ShieldOff } from "lucide-react";

type Source = "all" | "ranked" | "unranked" | "legacy";
type Stats = { total: number; analyzed: number; failed: number; pending: number; analyzerVersion: number; source: Source };
type Factor = { key: string; label: string; score: number; weight: number; contribution: number; reason: string };
type Rankability = { version: number; score: number; confidence: number; verdict: string; summary: string; factors: Factor[]; strengths: string[]; limitations: string[] };
type Analysis = { analyzerVersion: number; status: string; pointEligible: boolean };
type MapRow = { id: string; title: string; artist: string | null; mapperName: string | null; imageUrl: string | null; rating: number | null; sourceStatus: "ranked" | "unranked" | "legacy"; analysisStatus: string; analysis: Analysis | null; rankability: Rankability | null };
type Catalog = { maps: MapRow[]; page: number; pages: number; total: number; analyzerVersion: number; rankabilityVersion: number };

const sources: Array<{ key: Source; label: string }> = [
  { key: "all", label: "All" },
  { key: "ranked", label: "Ranked" },
  { key: "unranked", label: "Unranked" },
  { key: "legacy", label: "Legacy" },
];

export function RankabilityV4Manager() {
  const [source, setSource] = useState<Source>("all");
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [stats, setStats] = useState<Record<string, Stats | null>>({});
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const params = new URLSearchParams({ source, page: String(page) });
    if (appliedQuery) params.set("q", appliedQuery);
    try {
      const [catalogResponse, rankedResponse, unrankedResponse, legacyResponse] = await Promise.all([
        fetch(`/api/admin/maps/catalog?${params.toString()}`, { cache: "no-store" }),
        fetch("/api/admin/maps/analyze-ranked?source=ranked", { cache: "no-store" }),
        fetch("/api/admin/maps/analyze-ranked?source=unranked", { cache: "no-store" }),
        fetch("/api/admin/maps/analyze-ranked?source=legacy", { cache: "no-store" }),
      ]);
      const data = await catalogResponse.json();
      if (!catalogResponse.ok) throw new Error(data.error ?? "Could not load map analysis catalog.");
      setCatalog(data);
      const next: Record<string, Stats | null> = {};
      for (const [key, response] of [["ranked", rankedResponse], ["unranked", unrankedResponse], ["legacy", legacyResponse]] as const) {
        if (response.ok) next[key] = (await response.json()).stats ?? null;
      }
      setStats(next);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load map analysis catalog.");
    }
  }, [source, page, appliedQuery]);

  useEffect(() => { void load(); }, [load]);

  async function analyzeOne(id: string) {
    setBusy(id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/maps/${id}/analyze`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Map analysis failed.");
      setMessage(`Map analysis complete. Recalculated ${data.recalculatedUsers ?? 0} affected players.`);
      await load();
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "Map analysis failed.");
    } finally {
      setBusy("");
    }
  }

  async function analyzeSource(target: Exclude<Source, "all">) {
    if (busy) return;
    setBusy(`bulk:${target}`);
    setError("");
    setMessage("");
    let succeeded = 0;
    let failed = 0;
    try {
      for (;;) {
        const response = await fetch("/api/admin/maps/analyze-ranked", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: target, limit: 2 }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? `${target} map analysis failed.`);
        succeeded += data.succeeded ?? 0;
        failed += data.failed ?? 0;
        setMessage(`${target[0].toUpperCase()}${target.slice(1)} analysis: ${data.stats?.analyzed ?? succeeded}/${data.stats?.total ?? "?"} current · ${data.stats?.pending ?? 0} pending · ${data.stats?.failed ?? failed} failed.`);
        if (!data.processed || !data.stats?.pending) break;
      }
      setMessage(`${target[0].toUpperCase()}${target.slice(1)} analysis pass complete: ${succeeded} analyzed, ${failed} failed. Rankability v4 is now available for successfully analyzed maps.`);
      await load();
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : `${target} map analysis failed.`);
    } finally {
      setBusy("");
    }
  }

  async function setEligible(map: MapRow, pointEligible: boolean) {
    setBusy(map.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/maps/${map.id}/eligibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pointEligible }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not update point eligibility.");
      setMessage(`${pointEligible ? "Enabled" : "Disabled"} RPL/RPV/RPS earning for ${map.title}.`);
      await load();
    } catch (eligibilityError) {
      setError(eligibilityError instanceof Error ? eligibilityError.message : "Could not update point eligibility.");
    } finally {
      setBusy("");
    }
  }

  return <section className="ui-panel ui-panel-compact sm:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="ui-eyebrow">Rankability analyzer v4</p><h2 className="mt-2 text-2xl font-semibold text-white">Competitive map quality</h2><p className="mt-2 max-w-4xl text-sm leading-6 text-muted">V4 rewards deliberate movement, sustained challenge, structured pattern variety, readable pacing and clean transitions. It separately penalizes low-movement speed cheese and isolated difficulty spikes instead of treating normal pattern variation as a flaw. Ranked, unranked and legacy maps use the same 1-5 rankability scale.</p></div>
      <div className="rounded-2xl border border-accent/25 bg-accent/10 px-4 py-3 text-right"><p className="text-xs text-muted">Rankability model</p><p className="mt-1 text-xl font-black text-white">v{catalog?.rankabilityVersion ?? 4}</p></div>
    </div>

    <div className="mt-5 grid gap-3 md:grid-cols-3">
      {(["ranked", "unranked", "legacy"] as const).map((key) => { const item = stats[key]; return <div key={key} className="rounded-2xl border border-border bg-background/55 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{key}</p><p className="mt-1 text-lg font-semibold text-white">{item ? `${item.analyzed}/${item.total}` : "—"}</p><p className="text-xs text-muted">{item ? `${item.pending} pending · ${item.failed} failed` : "Loading coverage…"}</p></div><button type="button" disabled={Boolean(busy)} onClick={() => void analyzeSource(key)} className="rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{busy === `bulk:${key}` ? "Analyzing…" : `Analyze ${key}`}</button></div></div>; })}
    </div>

    <div className="mt-6 flex flex-col gap-3 lg:flex-row">
      <div className="flex flex-wrap gap-2">{sources.map((item) => <button key={item.key} type="button" onClick={() => { setSource(item.key); setPage(1); }} className={`rounded-full border px-4 py-2 text-xs font-semibold ${source === item.key ? "border-accent bg-accent/15 text-white" : "border-border text-muted hover:text-white"}`}>{item.label}</button>)}</div>
      <form onSubmit={(event) => { event.preventDefault(); setAppliedQuery(query.trim()); setPage(1); }} className="flex min-w-0 flex-1 gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title or mapper" className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-2 text-sm text-white outline-none focus:border-accent"/><button className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"><Search size={15}/>Search</button></form>
      <button type="button" onClick={() => void load()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-white"><RefreshCw size={15}/>Refresh</button>
    </div>

    {error && <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
    {message && <p className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">{message}</p>}

    <div className="mt-6 space-y-4">
      {catalog?.maps.map((map) => { const rankability = map.rankability; const current = map.analysisStatus === "analyzed"; return <article key={map.id} className="rounded-2xl border border-border bg-background/50 p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
          <div className="flex min-w-0 flex-1 gap-3">{map.imageUrl ? <img src={map.imageUrl} alt="" className="h-16 w-28 shrink-0 rounded-xl object-cover"/> : <div className="h-16 w-28 shrink-0 rounded-xl border border-border bg-black/20"/>}<div className="min-w-0"><h3 className="truncate font-semibold text-white">{map.title}</h3><p className="mt-1 truncate text-xs text-muted">{map.artist ?? "Unknown artist"} · {map.mapperName ?? "Unknown mapper"}</p><div className="mt-2 flex flex-wrap gap-2 text-xs"><span className="rounded-full border border-border px-2 py-1 capitalize text-muted">{map.sourceStatus}</span><span className={`rounded-full border px-2 py-1 ${current ? "border-emerald-400/30 text-emerald-300" : "border-amber-400/30 text-amber-300"}`}>{map.analysisStatus}</span>{map.rating != null && <span className="rounded-full border border-border px-2 py-1 text-white">Difficulty {map.rating.toFixed(2)}</span>}</div></div></div>
          <div className="min-w-[210px] rounded-2xl border border-accent/25 bg-accent/[0.08] p-4"><p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Rankability v{rankability?.version ?? 4}</p><p className="mt-1 text-3xl font-black text-white">{rankability ? rankability.score.toFixed(2) : "—"}<span className="text-sm text-muted"> / 5.00</span></p><p className="mt-1 text-xs font-semibold text-accent">{rankability?.verdict ?? "Analyze map to score"}</p>{rankability && <p className="mt-1 text-xs text-muted">Confidence {Math.round(rankability.confidence * 100)}%</p>}</div>
          <div className="flex flex-wrap gap-2"><button type="button" disabled={busy === map.id} onClick={() => void analyzeOne(map.id)} className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"><Activity size={14}/>{busy === map.id ? "Working…" : current ? "Analyze again" : "Analyze"}</button>{current && map.analysis && map.sourceStatus !== "legacy" && <button type="button" disabled={busy === map.id} onClick={() => void setEligible(map, !map.analysis!.pointEligible)} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">{map.analysis.pointEligible ? <ShieldOff size={14}/> : <ShieldCheck size={14}/>} {map.analysis.pointEligible ? "Disable points" : "Enable points"}</button>}</div>
        </div>
        {rankability && <div className="mt-4 border-t border-border pt-4"><p className="text-sm leading-6 text-muted">{rankability.summary}</p><div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{rankability.factors.map((factor) => <div key={factor.key} className="rounded-xl border border-border bg-black/10 p-3"><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold text-white">{factor.label}</p><p className="text-xs font-black text-accent">{factor.score.toFixed(2)}/5</p></div><p className="mt-2 text-xs leading-5 text-muted">{factor.reason}</p></div>)}</div>{rankability.limitations.length > 0 && <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3"><p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-200">Main limitations</p><div className="mt-2 space-y-1">{rankability.limitations.map((item) => <p key={item} className="text-xs leading-5 text-muted">• {item}</p>)}</div></div>}</div>}
      </article>; })}
    </div>

    {catalog && catalog.pages > 1 && <div className="mt-6 flex items-center justify-between"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm text-white disabled:opacity-40"><ChevronLeft size={15}/>Previous</button><p className="text-xs text-muted">Page {catalog.page} / {catalog.pages} · {catalog.total} maps</p><button type="button" disabled={page >= catalog.pages} onClick={() => setPage((value) => value + 1)} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm text-white disabled:opacity-40">Next<ChevronRight size={15}/></button></div>}
  </section>;
}
