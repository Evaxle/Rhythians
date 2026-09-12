"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Loader2, Sparkles } from "lucide-react";

const TEAM_TARGETS = [16, 32, 64] as const;

export function TournamentCreateCard() {
  const [name, setName] = useState("");
  const [mode, setMode] = useState("1v1");
  const [scheduledAt, setScheduledAt] = useState("");
  const [playersPerSplit, setPlayersPerSplit] = useState(16);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const teamSize = Number(mode.split("v")[0]) || 1;
  const playerTargets = useMemo(() => TEAM_TARGETS.map((teams) => teams * teamSize), [teamSize]);

  function changeMode(nextMode: string) {
    setMode(nextMode);
    const nextTeamSize = Number(nextMode.split("v")[0]) || 1;
    setPlayersPerSplit(16 * nextTeamSize);
  }

  async function createTournament() {
    if (!name.trim() || !scheduledAt) return;
    setWorking(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name: name.trim(), mode, scheduledAt: new Date(scheduledAt).toISOString(), targetPlayersPerSplit: playersPerSplit }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not create tournament.");
      const poolText = result.mapPool ? ` Map pool created: Lower ${result.mapPool.lower.regular} + ${result.mapPool.lower.finals}, Higher ${result.mapPool.higher.regular} + ${result.mapPool.higher.finals}.` : "";
      setMessage(`Tournament published and signups are open.${poolText}${result.mapPoolWarning ? ` Map pool warning: ${result.mapPoolWarning}` : ""}`);
      setName(""); setScheduledAt(""); window.setTimeout(() => window.location.reload(), 900);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not create tournament."); }
    finally { setWorking(false); }
  }

  return <section className="rounded-3xl border border-accent/20 bg-gradient-to-br from-accent/[0.08] via-surface/95 to-surface/95 p-6 shadow-glow sm:p-7">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.22em] text-accent">Schedule & publish</p><h2 className="mt-2 text-2xl font-semibold text-white">Create scheduled tournament</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Creating a tournament publishes it immediately, opens signups, and builds editable 106-map pools for both splits. Brackets start at 16 teams per split and expand to 32, then 64 teams as signups fill. Tournament scores must be fresh No Mod passes.</p></div><div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-200"><Sparkles size={14} />Auto map pool</div></div>
    <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(220px,1fr)_130px_190px_230px_auto]">
      <label className="space-y-1.5"><span className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Tournament name" className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-accent/40" /></label>
      <label className="space-y-1.5"><span className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Mode</span><select value={mode} onChange={(event) => changeMode(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#101629] px-4 py-3 text-sm text-white"><option value="1v1">1v1</option><option value="2v2">2v2</option><option value="3v3">3v3</option></select></label>
      <label className="space-y-1.5"><span className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Players per split</span><select value={playersPerSplit} onChange={(event) => setPlayersPerSplit(Number(event.target.value))} className="w-full rounded-2xl border border-white/10 bg-[#101629] px-4 py-3 text-sm text-white">{playerTargets.map((target, index) => <option key={target} value={target}>{target} players · {TEAM_TARGETS[index]} teams{index === 0 ? " · Base" : ""}</option>)}</select></label>
      <label className="space-y-1.5"><span className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Starts</span><input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white" /></label>
      <button disabled={working || !name.trim() || !scheduledAt} onClick={() => void createTournament()} className="ui-button mt-[22px] min-h-11 bg-accent text-white disabled:cursor-not-allowed disabled:opacity-40">{working ? <Loader2 size={16} className="animate-spin" /> : <CalendarClock size={16} />}Create</button>
    </div>
    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted"><span>1v1: 16 / 32 / 64 players</span><span>2v2: 32 / 64 / 128 players</span><span>3v3: 48 / 96 / 192 players</span><span>Lower regular: 1.3–2.3</span><span>Lower semi/finals: 2.3–2.7</span><span>Higher regular: 3.0–3.5</span><span>Higher semi/finals: 3.6–3.7</span><span>100 regular + 6 finals per split</span><span>No Mod passes only</span></div>
    {message && <p className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${message.startsWith("Tournament published") ? "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-100" : "border-rose-400/20 bg-rose-400/[0.07] text-rose-100"}`}>{message}</p>}
  </section>;
}
