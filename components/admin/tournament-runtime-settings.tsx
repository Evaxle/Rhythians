"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, Loader2, Save, UsersRound } from "lucide-react";

const CAPS: Record<string, number[]> = { "1v1": [4, 8, 16], "2v2": [8, 16, 32], "3v3": [12, 24, 48] };

export function TournamentRuntimeSettings() {
  const [state, setState] = useState<any>(null);
  const [selectedId, setSelectedId] = useState("");
  const [target, setTarget] = useState(16);
  const [matchSeconds, setMatchSeconds] = useState(600);
  const [intermissionSeconds, setIntermissionSeconds] = useState(300);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  function absorb(data: any) {
    setState(data);
    const selected = data.selected;
    const id = selected?.tournament?.id ?? data.tournaments?.[0]?.id ?? "";
    setSelectedId(id);
    if (selected?.tournament) {
      const mode = String(selected.tournament.mode);
      setTarget(Number(selected.runtime?.targetPlayersPerSplit ?? selected.tournament.targetPlayersPerSplit ?? CAPS[mode]?.at(-1) ?? 16));
      setMatchSeconds(Number(selected.runtime?.matchDurationSeconds ?? selected.tournament.matchDurationSeconds ?? 600));
      setIntermissionSeconds(Number(selected.runtime?.intermissionSeconds ?? selected.tournament.intermissionSeconds ?? 300));
    }
  }

  async function load(id = selectedId) {
    const response = await fetch(`/api/admin/tournaments${id ? `?id=${encodeURIComponent(id)}` : ""}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Could not load tournament settings.");
    absorb(data);
  }

  useEffect(() => { void load().catch((error) => setMessage(error instanceof Error ? error.message : "Could not load tournament settings.")); }, []);

  const tournament = state?.selected?.tournament;
  const caps = useMemo(() => CAPS[String(tournament?.mode)] ?? [], [tournament?.mode]);
  const teamSize = Number(String(tournament?.mode ?? "1v1").split("v")[0]) || 1;
  const teams = target / teamSize;
  const mapsPerSplit = Math.max(0, teams - 1);
  const canEdit = tournament?.status === "scheduled";

  async function save() {
    if (!selectedId) return;
    setWorking(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/tournaments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "runtime-settings", tournamentId: selectedId, targetPlayersPerSplit: target, matchDurationSeconds: matchSeconds, intermissionSeconds }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save tournament runtime settings.");
      absorb(data.state);
      setMessage("Tournament bracket target and runtime timing saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save tournament settings.");
    } finally { setWorking(false); }
  }

  if (!state?.tournaments?.length) return null;
  return <section className="rounded-[2rem] border border-white/10 bg-surface/95 p-5 shadow-glow sm:p-6">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-accent"><UsersRound size={14} /> Bracket runtime</p><h2 className="mt-1 text-xl font-bold text-white">Full bracket target & match timing</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Both Lower and Higher must reach this exact player target before the tournament can start. Once a split reaches the target, new registrations for that split are unavailable.</p></div><select value={selectedId} onChange={(event) => { const id = event.target.value; setSelectedId(id); void load(id); }} className="rounded-xl border border-white/10 bg-[#101629] px-4 py-2.5 text-sm text-white">{state.tournaments.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
    {tournament && <div className="mt-5 grid gap-3 md:grid-cols-3">
      <label className="rounded-2xl border border-white/10 bg-black/10 p-4"><span className="text-[10px] font-black uppercase tracking-[0.16em] text-muted">Players per split</span><select disabled={!canEdit} value={target} onChange={(event) => setTarget(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-white/10 bg-[#101629] px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50">{caps.map((cap) => <option key={cap} value={cap}>{cap} players · {cap / teamSize} teams</option>)}</select><p className="mt-2 text-[11px] text-muted">Requires {mapsPerSplit} unique maps per split.</p></label>
      <label className="rounded-2xl border border-white/10 bg-black/10 p-4"><span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-muted"><Clock3 size={12} /> Match score window</span><select disabled={!canEdit} value={matchSeconds} onChange={(event) => setMatchSeconds(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-white/10 bg-[#101629] px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50">{[300, 420, 600, 720, 900, 1200, 1800].map((seconds) => <option key={seconds} value={seconds}>{seconds / 60} minutes</option>)}</select><p className="mt-2 text-[11px] text-muted">No submission by the deadline triggers automatic resolution.</p></label>
      <label className="rounded-2xl border border-white/10 bg-black/10 p-4"><span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-muted"><Clock3 size={12} /> Between matchups</span><select disabled={!canEdit} value={intermissionSeconds} onChange={(event) => setIntermissionSeconds(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-white/10 bg-[#101629] px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50">{[300, 360, 420, 480, 540, 600].map((seconds) => <option key={seconds} value={seconds}>{seconds / 60} minutes</option>)}</select><p className="mt-2 text-[11px] text-muted">Then 1 minute to map reveal + 1 minute to load the map.</p></label>
    </div>}
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted">{tournament?.status === "scheduled" ? `${tournament.name} · ${tournament.mode} · editable` : "Runtime settings lock when the tournament starts."}</p>{canEdit && <button disabled={working} onClick={() => void save()} className="ui-button bg-accent text-white disabled:opacity-40">{working ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}Save runtime</button>}</div>
    {message && <p className="mt-3 rounded-xl border border-accent/20 bg-accent/[0.06] p-3 text-xs text-white">{message}</p>}
  </section>;
}
