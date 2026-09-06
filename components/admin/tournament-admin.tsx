"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CalendarClock, Check, Crown, Loader2, MapPinPlus, Play, RefreshCw, Search, Shuffle, Swords, Trash2, X } from "lucide-react";
import { TournamentBracket } from "@/components/tournaments/tournament-bracket";

type Split = "lower" | "higher";

function localInput(date?: string | null) {
  if (!date) return "";
  const value = new Date(date);
  const offset = value.getTimezoneOffset() * 60000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

function TeamName({ team }: { team: any }) {
  return <>{team?.members?.map((member: any) => member.displayName ?? member.username).join(" + ") || `Team ${team?.seed ?? "?"}`}</>;
}

export function TournamentAdmin() {
  const [state, setState] = useState<any>(null);
  const [selectedId, setSelectedId] = useState("");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState("1v1");
  const [scheduledAt, setScheduledAt] = useState("");
  const [editName, setEditName] = useState("");
  const [editMode, setEditMode] = useState("1v1");
  const [editDate, setEditDate] = useState("");
  const [mapQuery, setMapQuery] = useState("");
  const [mapResults, setMapResults] = useState<any[]>([]);
  const [mapSearching, setMapSearching] = useState(false);
  const [firstSwap, setFirstSwap] = useState("");
  const [secondSwap, setSecondSwap] = useState("");

  async function load(id = selectedId) {
    try {
      const response = await fetch(`/api/admin/tournaments${id ? `?id=${encodeURIComponent(id)}` : ""}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not load tournaments.");
      setState(result);
      const nextId = result.selected?.tournament?.id ?? result.tournaments?.[0]?.id ?? "";
      setSelectedId(nextId);
      if (result.selected?.tournament) {
        setEditName(result.selected.tournament.name);
        setEditMode(result.selected.tournament.mode);
        setEditDate(localInput(result.selected.tournament.scheduledAt));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load tournaments.");
    }
  }

  useEffect(() => { void load(""); }, []);

  async function adminAction(action: string, payload: Record<string, unknown> = {}) {
    setWorking(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/tournaments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, tournamentId: selectedId, ...payload }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Tournament action failed.");
      if (result.state) {
        setState(result.state);
        setSelectedId(result.state.selected?.tournament?.id ?? selectedId);
      } else await load(selectedId);
      setMessage("Saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Tournament action failed.");
    } finally {
      setWorking(false);
    }
  }

  async function create() {
    if (!scheduledAt) return setMessage("Choose a scheduled date and time.");
    setWorking(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/tournaments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", name, mode, scheduledAt: new Date(scheduledAt).toISOString() }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not create tournament.");
      setName("");
      setScheduledAt("");
      setSelectedId(result.id);
      setState(result.state);
      setMessage("Tournament published for signup.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create tournament.");
    } finally {
      setWorking(false);
    }
  }

  async function searchMaps() {
    if (!mapQuery.trim()) return setMapResults([]);
    setMapSearching(true);
    try {
      const response = await fetch(`/api/admin/maps/search?q=${encodeURIComponent(mapQuery.trim())}`, { cache: "no-store" });
      const result = await response.json();
      setMapResults(result.maps ?? []);
    } finally {
      setMapSearching(false);
    }
  }

  const selected = state?.selected;
  const scheduled = selected?.tournament?.status === "scheduled";
  const acceptedUsers = useMemo(() => selected?.signups?.filter((signup: any) => signup.status === "accepted") ?? [], [selected]);

  return (
    <div className="space-y-7">
      <section className="rounded-3xl border border-border bg-surface/95 p-7 shadow-glow">
        <p className="text-sm uppercase tracking-[0.3em] text-accent">Tournament control</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Tournaments</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">Publish tournament signups, manage split requests and map pools, generate or edit brackets, start rounds, and resolve exceptional matches.</p>
      </section>

      <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
        <h2 className="text-xl font-semibold text-white">Publish a scheduled tournament</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_160px_240px_auto]">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Tournament name" className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-accent/40" />
          <select value={mode} onChange={(event) => setMode(event.target.value)} className="rounded-2xl border border-white/10 bg-[#101629] px-4 py-3 text-sm text-white"><option value="1v1">1v1</option><option value="2v2">2v2</option><option value="3v3">3v3</option></select>
          <input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white" />
          <button disabled={working || !name.trim() || !scheduledAt} onClick={() => void create()} className="ui-button bg-accent text-white disabled:opacity-40">{working ? <Loader2 size={16} className="animate-spin" /> : <CalendarClock size={16} />}Publish</button>
        </div>
      </section>

      {state?.tournaments?.length > 0 && <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold text-white">Tournament records</h2><button onClick={() => void load(selectedId)} className="rounded-full border border-white/10 p-2 text-muted hover:text-white"><RefreshCw size={16} /></button></div><div className="mt-4 flex gap-2 overflow-x-auto pb-2">{state.tournaments.map((tournament: any) => <button key={tournament.id} onClick={() => { setSelectedId(tournament.id); void load(tournament.id); }} className={`min-w-[220px] rounded-2xl border p-4 text-left ${selectedId === tournament.id ? "border-accent/40 bg-accent/10" : "border-white/10 bg-black/10"}`}><p className="truncate font-semibold text-white">{tournament.name}</p><p className="mt-1 text-xs text-muted">{tournament.mode} · {tournament.status}</p><p className="mt-1 text-xs text-muted">{new Date(tournament.scheduledAt).toLocaleString()}</p></button>)}</div></section>}

      {selected && <>
        <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Selected tournament</p><h2 className="mt-2 text-2xl font-bold text-white">{selected.tournament.name}</h2><p className="mt-1 text-sm text-muted">{selected.tournament.status} · {selected.mode}</p></div><div className="flex flex-wrap gap-2">{scheduled && <><button disabled={working} onClick={() => void adminAction("build")} className="ui-button border border-white/10 bg-white/5 text-white"><Swords size={16} />Build brackets</button><button disabled={working} onClick={() => void adminAction("start")} className="ui-button bg-emerald-600 text-white"><Play size={16} />Start tournament</button><button disabled={working} onClick={() => void adminAction("cancel")} className="ui-button border border-rose-400/20 bg-rose-400/10 text-rose-200"><X size={16} />Cancel</button></>}</div></div>
          {scheduled && <div className="mt-5 grid gap-3 md:grid-cols-[1fr_140px_240px_auto]"><input value={editName} onChange={(event) => setEditName(event.target.value)} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white" /><select value={editMode} onChange={(event) => setEditMode(event.target.value)} className="rounded-2xl border border-white/10 bg-[#101629] px-4 py-3 text-sm text-white"><option value="1v1">1v1</option><option value="2v2">2v2</option><option value="3v3">3v3</option></select><input type="datetime-local" value={editDate} onChange={(event) => setEditDate(event.target.value)} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white" /><button disabled={working || !editDate} onClick={() => void adminAction("update", { name: editName, mode: editMode, scheduledAt: new Date(editDate).toISOString() })} className="ui-button border border-white/10 bg-white/5 text-white">Save schedule</button></div>}
          <div className="mt-5 grid gap-3 md:grid-cols-2">{(["lower", "higher"] as Split[]).map((split) => { const cap = selected.caps[split]; return <div key={split} className="rounded-2xl border border-white/10 bg-black/15 p-4"><div className="flex items-center justify-between"><p className="font-semibold capitalize text-white">{split}</p><span className="text-sm font-bold text-accent">{cap.count}/{cap.maximum}</span></div><p className="mt-2 text-xs text-muted">Player caps: {cap.caps.join(" → ")} · secured: {cap.secured || "none"}</p>{!cap.canStart && <p className="mt-2 text-xs text-amber-200">Minimum not reached.</p>}{cap.atRisk && <p className="mt-2 text-xs text-amber-200">Players above the secured cap need {cap.next} total to become accepted.</p>}</div>; })}</div>
        </section>

        <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
          <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Entrants</p><h2 className="mt-1 text-xl font-semibold text-white">Signups and split requests</h2></div><span className="text-sm text-muted">{selected.signups.length} records</span></div>
          <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="text-xs uppercase tracking-[0.14em] text-muted"><tr><th className="pb-3">Player</th><th className="pb-3">Rank</th><th className="pb-3">Split</th><th className="pb-3">Status</th><th className="pb-3">Request</th><th className="pb-3">Controls</th></tr></thead><tbody className="divide-y divide-white/5">{selected.signups.map((signup: any) => <tr key={signup.id}><td className="py-3"><p className="font-semibold text-white">{signup.displayName ?? signup.username}</p><p className="text-xs text-muted">@{signup.profileHandle}</p></td><td className="py-3 text-muted">{signup.rankName} {signup.rankTier} · {signup.rhpSnapshot} RHP</td><td className="py-3 capitalize text-white">{signup.split}</td><td className="py-3"><span className="rounded-full border border-white/10 px-2.5 py-1 text-xs capitalize text-muted">{signup.status}</span>{signup.priority && <span className="ml-2 rounded-full border border-accent/20 bg-accent/10 px-2.5 py-1 text-xs text-accent">priority</span>}</td><td className="py-3">{signup.splitRequestStatus === "pending" ? <div><p className="mb-2 text-xs text-amber-200">Requests {signup.requestedSplit}</p><div className="flex gap-1"><button disabled={working} onClick={() => void adminAction("resolve-split", { userId: signup.userId, approve: true })} className="rounded-lg bg-emerald-500/15 p-2 text-emerald-200"><Check size={14} /></button><button disabled={working} onClick={() => void adminAction("resolve-split", { userId: signup.userId, approve: false })} className="rounded-lg bg-rose-500/15 p-2 text-rose-200"><X size={14} /></button></div></div> : <span className="text-xs text-muted">{signup.splitRequestStatus}</span>}</td><td className="py-3"><div className="flex flex-wrap gap-2"><button disabled={working || !scheduled} onClick={() => void adminAction("set-split", { userId: signup.userId, split: signup.split === "lower" ? "higher" : "lower" })} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white disabled:opacity-30">Move to {signup.split === "lower" ? "Higher" : "Lower"}</button><button disabled={working || !scheduled} onClick={() => void adminAction("priority", { userId: signup.userId, priority: !signup.priority })} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white disabled:opacity-30">{signup.priority ? "Remove priority" : "Prioritize"}</button></div></td></tr>)}</tbody></table></div>
        </section>

        <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Map pools</p><h2 className="mt-1 text-xl font-semibold text-white">Tournament-only maps</h2><p className="mt-2 text-sm text-muted">Each split only draws maps from its own pool.</p>
          {scheduled && <div className="mt-5 flex gap-2"><input value={mapQuery} onChange={(event) => setMapQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void searchMaps(); }} placeholder="Search approved maps" className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white" /><button onClick={() => void searchMaps()} className="ui-button border border-white/10 bg-white/5 text-white">{mapSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}Search</button></div>}
          {mapResults.length > 0 && scheduled && <div className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-white/10 p-2">{mapResults.map((map: any) => <div key={map.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-black/15 p-3"><div className="min-w-0"><p className="truncate font-semibold text-white">{map.title}</p><p className="text-xs text-muted">{map.artist ?? ""} · {String(map.status)} · {map.rating != null ? `${Number(map.rating).toFixed(2)}★` : "unrated"}</p></div><div className="flex gap-2"><button onClick={() => void adminAction("add-map", { split: "lower", mapId: map.id })} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white">+ Lower</button><button onClick={() => void adminAction("add-map", { split: "higher", mapId: map.id })} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white">+ Higher</button></div></div>)}</div>}
          <div className="mt-5 grid gap-4 lg:grid-cols-2">{(["lower", "higher"] as Split[]).map((split) => <div key={split} className="rounded-2xl border border-white/10 bg-black/10 p-4"><div className="flex items-center gap-2"><MapPinPlus size={16} className="text-accent" /><h3 className="font-semibold capitalize text-white">{split} pool</h3></div><div className="mt-3 space-y-2">{selected.mapPool.filter((map: any) => map.split === split).map((map: any) => <div key={map.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2"><div className="min-w-0"><p className="truncate text-sm font-medium text-white">{map.title}</p><p className="text-xs text-muted">{map.rating != null ? `${Number(map.rating).toFixed(2)}★` : ""}{map.length != null ? ` · ${Math.floor(Number(map.length) / 60)}:${String(Number(map.length) % 60).padStart(2, "0")}` : ""}</p></div>{scheduled && <button onClick={() => void adminAction("remove-map", { split, mapId: map.mapId })} className="p-2 text-rose-300"><Trash2 size={14} /></button>}</div>)}{!selected.mapPool.some((map: any) => map.split === split) && <p className="py-4 text-center text-sm text-muted">No maps yet.</p>}</div></div>)}</div>
        </section>

        {selected.teams.length > 0 && <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Manual bracket controls</p><h2 className="mt-1 text-xl font-semibold text-white">Seeds and player placement</h2></div><Shuffle size={20} className="text-accent" /></div><p className="mt-2 text-sm text-muted">Move whole teams through bracket seeds or swap two accepted players between teams. Rebuild brackets at any time before starting to return to automatic rank/tier placement.</p><div className="mt-5 grid gap-4 lg:grid-cols-2">{(["lower", "higher"] as Split[]).map((split) => <div key={split} className="rounded-2xl border border-white/10 p-4"><p className="mb-3 font-semibold capitalize text-white">{split} teams</p><div className="space-y-2">{selected.teams.filter((team: any) => team.split === split).map((team: any) => <div key={team.id} className="flex items-center gap-2 rounded-xl bg-black/15 p-3"><span className="w-8 text-center text-sm font-black text-accent">#{team.seed}</span><p className="min-w-0 flex-1 truncate text-sm text-white"><TeamName team={team} /></p>{scheduled && <><button onClick={() => void adminAction("move-seed", { teamId: team.id, direction: -1 })} className="rounded-lg border border-white/10 p-2 text-muted"><ArrowUp size={13} /></button><button onClick={() => void adminAction("move-seed", { teamId: team.id, direction: 1 })} className="rounded-lg border border-white/10 p-2 text-muted"><ArrowDown size={13} /></button></>}</div>)}</div></div>)}</div>{scheduled && acceptedUsers.length > 1 && <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]"><select value={firstSwap} onChange={(event) => setFirstSwap(event.target.value)} className="rounded-2xl border border-white/10 bg-[#101629] px-4 py-3 text-sm text-white"><option value="">First player</option>{acceptedUsers.map((signup: any) => <option key={signup.userId} value={signup.userId}>{signup.displayName ?? signup.username} · {signup.split}</option>)}</select><select value={secondSwap} onChange={(event) => setSecondSwap(event.target.value)} className="rounded-2xl border border-white/10 bg-[#101629] px-4 py-3 text-sm text-white"><option value="">Second player</option>{acceptedUsers.map((signup: any) => <option key={signup.userId} value={signup.userId}>{signup.displayName ?? signup.username} · {signup.split}</option>)}</select><button disabled={!firstSwap || !secondSwap || firstSwap === secondSwap} onClick={() => void adminAction("swap-members", { firstUserId: firstSwap, secondUserId: secondSwap })} className="ui-button border border-white/10 bg-white/5 text-white disabled:opacity-40"><Shuffle size={16} />Swap players</button></div>}</section>}

        {selected.matches.some((match: any) => match.status === "needs_admin") && <section className="rounded-3xl border border-amber-400/20 bg-amber-400/[0.06] p-6"><p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200">Action required</p><h2 className="mt-1 text-xl font-semibold text-white">Resolve tied or incomplete matches</h2><div className="mt-4 space-y-3">{selected.matches.filter((match: any) => match.status === "needs_admin").map((match: any) => <div key={match.id} className="rounded-2xl border border-amber-400/15 bg-black/15 p-4"><p className="text-sm text-muted">{match.split} · round {match.round}</p><div className="mt-3 flex flex-wrap gap-2"><button onClick={() => void adminAction("force-winner", { tournamentMatchId: match.id, winnerTeamId: match.team1Id })} className="rounded-full border border-white/10 px-4 py-2 text-sm text-white"><Crown size={14} className="mr-2 inline" /><TeamName team={match.team1} /></button><button onClick={() => void adminAction("force-winner", { tournamentMatchId: match.id, winnerTeamId: match.team2Id })} className="rounded-full border border-white/10 px-4 py-2 text-sm text-white"><Crown size={14} className="mr-2 inline" /><TeamName team={match.team2} /></button></div></div>)}</div></section>}

        {selected.matches.length > 0 && <div className="space-y-5"><TournamentBracket matches={selected.matches} split="lower" /><TournamentBracket matches={selected.matches} split="higher" /></div>}
      </>}

      {message && <p className="rounded-2xl border border-accent/20 bg-accent/[0.06] p-4 text-sm text-white">{message}</p>}
    </div>
  );
}
