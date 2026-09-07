"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, MapPinned, Plus, RefreshCw, Search, Trash2 } from "lucide-react";

type Split = "lower" | "higher";

export function TournamentMapPoolAdmin() {
  const [state, setState] = useState<any>(null);
  const [selectedId, setSelectedId] = useState("");
  const [split, setSplit] = useState<Split>("lower");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  async function load(id = selectedId) {
    const response = await fetch(`/api/admin/tournaments${id ? `?id=${encodeURIComponent(id)}` : ""}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Could not load tournament map pools.");
    setState(data);
    setSelectedId(data.selected?.tournament?.id ?? data.tournaments?.[0]?.id ?? "");
  }

  useEffect(() => { void load().catch((error) => setMessage(error instanceof Error ? error.message : "Could not load tournaments.")); }, []);

  async function search() {
    if (!query.trim()) return setResults([]);
    setWorking(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/maps/search?ranked=1&q=${encodeURIComponent(query.trim())}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Map search failed.");
      setResults(data.maps ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Map search failed.");
    } finally { setWorking(false); }
  }

  async function action(actionName: "add-map" | "remove-map", mapId: string) {
    if (!selectedId) return;
    setWorking(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/tournaments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: actionName, tournamentId: selectedId, split, mapId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Map pool update failed.");
      setState(data.state);
      setMessage(actionName === "add-map" ? "Ranked map added to this split." : "Map removed from this split.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Map pool update failed.");
    } finally { setWorking(false); }
  }

  const selected = state?.selected;
  const pool = useMemo(() => selected?.mapPool?.filter((map: any) => map.split === split) ?? [], [selected, split]);
  const required = Number(selected?.runtime?.mapsRequiredPerSplit ?? selected?.preflight?.mapsRequiredPerSplit ?? 0);
  const complete = required > 0 && pool.length >= required;
  const scheduled = selected?.tournament?.status === "scheduled";

  return <div className="space-y-6">
    <section className="rounded-[2rem] border border-white/10 bg-surface/95 p-6 shadow-glow sm:p-7"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-accent"><MapPinned size={15} /> Tournament maps</p><h1 className="mt-2 text-3xl font-bold text-white">Split map pools</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-muted">Every tournament match receives one unique map from its split&apos;s pool. Only approved ranked maps are accepted, and a tournament cannot start until each pool contains enough unique maps for every match in its full bracket.</p></section>

    {state?.tournaments?.length ? <section className="rounded-[2rem] border border-white/10 bg-surface/95 p-5 shadow-glow"><div className="flex flex-wrap items-center gap-3"><select value={selectedId} onChange={(event) => { const id = event.target.value; setSelectedId(id); void load(id); }} className="min-w-[260px] flex-1 rounded-xl border border-white/10 bg-[#101629] px-4 py-3 text-sm text-white">{state.tournaments.map((tournament: any) => <option key={tournament.id} value={tournament.id}>{tournament.name} · {tournament.status}</option>)}</select><button onClick={() => void load()} className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white"><RefreshCw size={16} /></button></div></section> : null}

    {selected && <>
      <section className="grid gap-3 sm:grid-cols-2">{(["lower", "higher"] as Split[]).map((item) => { const count = selected.mapPool?.filter((map: any) => map.split === item).length ?? 0; const good = required > 0 && count >= required; return <button key={item} onClick={() => setSplit(item)} className={`rounded-[1.6rem] border p-5 text-left transition ${split === item ? "border-accent/40 bg-accent/[0.08]" : "border-white/10 bg-surface/80"}`}><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-accent">{item} split</p><p className="mt-1 text-xl font-bold text-white">{count} / {required || "?"} unique maps</p></div>{good && <CheckCircle2 className="text-emerald-300" size={22} />}</div><p className={`mt-2 text-xs ${good ? "text-emerald-200" : "text-amber-200"}`}>{good ? "Pool is large enough for this bracket." : `${Math.max(0, required - count)} more ranked map${Math.max(0, required - count) === 1 ? "" : "s"} required.`}</p></button>; })}</section>

      <section className="rounded-[2rem] border border-white/10 bg-surface/95 p-5 shadow-glow sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-accent">{split} pool</p><h2 className="mt-1 text-xl font-bold text-white">Assigned ranked maps</h2></div><span className={`rounded-full border px-3 py-1.5 text-xs font-bold ${complete ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200" : "border-amber-400/20 bg-amber-400/10 text-amber-200"}`}>{complete ? "Start-ready" : "Needs maps"}</span></div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">{pool.map((map: any) => <div key={map.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/7 bg-black/10 p-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-white">{map.title}</p><p className="mt-1 truncate text-[11px] text-muted">{map.artist || "Unknown artist"} · {map.rating != null ? `${Number(map.rating).toFixed(2)}★` : "Ranked"}</p></div>{scheduled && <button disabled={working} onClick={() => void action("remove-map", map.mapId)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-400/10 text-rose-200 disabled:opacity-40"><Trash2 size={14} /></button>}</div>)}{!pool.length && <div className="md:col-span-2 rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-muted">No ranked maps are in this split pool yet.</div>}</div>
      </section>

      {scheduled && <section className="rounded-[2rem] border border-white/10 bg-surface/95 p-5 shadow-glow sm:p-6"><h2 className="text-xl font-bold text-white">Add ranked maps</h2><p className="mt-1 text-sm text-muted">Search only returns maps currently eligible as ranked tournament maps.</p><div className="mt-4 flex gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void search(); }} placeholder="Search ranked maps…" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none focus:border-accent/40" /><button disabled={working || !query.trim()} onClick={() => void search()} className="ui-button bg-accent text-white disabled:opacity-40">{working ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}Search</button></div><div className="mt-4 grid gap-2 md:grid-cols-2">{results.map((map: any) => { const already = pool.some((item: any) => item.mapId === map.id); return <div key={map.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/7 bg-black/10 p-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-white">{map.title}</p><p className="mt-1 truncate text-[11px] text-muted">{map.artist || "Unknown artist"}{map.rating != null ? ` · ${Number(map.rating).toFixed(2)}★` : ""}</p></div><button disabled={working || already} onClick={() => void action("add-map", map.id)} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-accent/20 bg-accent/10 px-3 py-2 text-xs font-bold text-accent disabled:opacity-35">{already ? <CheckCircle2 size={13} /> : <Plus size={13} />}{already ? "Added" : "Add"}</button></div>; })}</div></section>}
    </>}

    {message && <p className="rounded-2xl border border-accent/20 bg-accent/[0.06] p-4 text-sm text-white">{message}</p>}
  </div>;
}
