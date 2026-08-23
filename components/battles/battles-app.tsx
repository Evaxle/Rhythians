"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, RefreshCw, Search, Swords, Users, Trophy, Loader2, History } from "lucide-react";

const modes = ["1v1", "2v2", "3v3", "15v15"] as const;
const casualMapModes = ["lowest", "middle", "highest", "manual"] as const;

type MapItem = { id: string; title: string; artist?: string | null; starRating?: number | null };

export function BattlesApp() {
  const [tab, setTab] = useState<"lobbies" | "battles">("battles");
  const [battleTab, setBattleTab] = useState<"casual" | "ranked">("casual");
  const [mode, setMode] = useState("1v1");
  const [teamMode, setTeamMode] = useState("regular");
  const [casualMapMode, setCasualMapMode] = useState<(typeof casualMapModes)[number]>("lowest");
  const [manualMap, setManualMap] = useState<MapItem | null>(null);
  const [mapQuery, setMapQuery] = useState("");
  const [mapResults, setMapResults] = useState<MapItem[]>([]);
  const [searchingMaps, setSearchingMaps] = useState(false);
  const [lobbies, setLobbies] = useState<any[]>([]);
  const [queueing, setQueueing] = useState(false);
  const [lobbyName, setLobbyName] = useState("");
  const [creatingLobby, setCreatingLobby] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function loadLobbies(manual = false) {
    if (manual) setRefreshing(true);
    try {
      const response = await fetch("/api/battles/lobbies", { cache: "no-store" });
      if (response.ok) setLobbies((await response.json()).lobbies ?? []);
    } finally {
      if (manual) setRefreshing(false);
    }
  }

  async function searchMaps(value = mapQuery) {
    setSearchingMaps(true);
    try {
      const response = await fetch(`/api/battles/maps?q=${encodeURIComponent(value)}`, { cache: "no-store" });
      const data = await response.json();
      if (response.ok) setMapResults(data.maps ?? []);
    } finally {
      setSearchingMaps(false);
    }
  }

  useEffect(() => {
    void loadLobbies();
    const timer = setInterval(() => void loadLobbies(), 2500);
    return () => clearInterval(timer);
  }, []);

  async function queue() {
    setQueueing(true);
    setError("");
    if (battleTab === "casual" && casualMapMode === "manual" && !manualMap) {
      setError("Select a map for manual selection.");
      setQueueing(false);
      return;
    }
    const response = await fetch("/api/battles/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "queue", mode, matchType: battleTab, teamMode: battleTab === "ranked" ? "regular" : teamMode }),
    });
    const data = await response.json();
    if (!response.ok) {
      setQueueing(false);
      setError(data.error ?? "Could not join matchmaking.");
      return;
    }
    if (battleTab === "casual") {
      const selectionResponse = await fetch(`/api/battles/matches/${data.matchId}/map-selection`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: casualMapMode, mapId: manualMap?.id ?? null }),
      });
      if (!selectionResponse.ok) {
        const selectionData = await selectionResponse.json().catch(() => null);
        setQueueing(false);
        setError(selectionData?.error ?? "Could not save the map selection.");
        return;
      }
    }
    window.location.href = `/battles/match/${data.matchId}`;
  }

  async function createLobby() {
    if (!lobbyName.trim()) return;
    setCreatingLobby(true);
    setError("");
    const response = await fetch("/api/battles/lobbies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: lobbyName, mode, matchType: "casual" }),
    });
    const data = await response.json();
    setCreatingLobby(false);
    if (!response.ok) {
      setError(data.error ?? "Could not create lobby.");
      return;
    }
    window.location.href = data.url ?? `/battles/lobby/${data.lobbyId}`;
  }

  function selectBattleTab(next: "casual" | "ranked") {
    setBattleTab(next);
    if (next === "ranked") setTeamMode("regular");
  }

  return <div className="mx-auto max-w-7xl space-y-6">
    <section className="overflow-hidden rounded-3xl border border-border bg-surface/95 shadow-glow">
      <div className="relative p-7">
        <div className={`absolute right-0 top-0 h-48 w-48 rounded-full blur-3xl ${battleTab === "ranked" && tab === "battles" ? "bg-red-500/10" : "bg-accent/10"}`} />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div><p className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-accent"><Swords size={15} /> Rhythian Battles</p><h1 className="mt-2 text-4xl font-semibold text-white">Compete together.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Build a team, find opponents, play a rank-matched battle, and check your score when you finish the selected map.</p></div>
          <div className="flex flex-wrap gap-2"><Link href="/battles/history" className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background/60 px-4 py-2.5 text-sm font-semibold text-white hover:border-accent/40"><History size={15} /> History</Link><div className="flex rounded-2xl border border-border bg-background/60 p-1"><button onClick={() => setTab("lobbies")} className={`rounded-xl px-5 py-2.5 text-sm font-semibold ${tab === "lobbies" ? "bg-accent text-white" : "text-muted hover:text-white"}`}><Users className="mr-2 inline" size={15} />Lobbies</button><button onClick={() => setTab("battles")} className={`rounded-xl px-5 py-2.5 text-sm font-semibold ${tab === "battles" ? "bg-accent text-white" : "text-muted hover:text-white"}`}><Trophy className="mr-2 inline" size={15} />Battles</button></div></div>
        </div>
      </div>
    </section>
    {tab === "battles" ? <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
      <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-xl font-semibold text-white">Battle queue</h2><p className="mt-1 text-sm text-muted">Ranked matches use your exact rank and tier. Casual uses the selected rank pool.</p></div><div className="flex rounded-xl border border-border bg-background/60 p-1"><button onClick={() => selectBattleTab("casual")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${battleTab === "casual" ? "bg-white/10 text-white" : "text-muted"}`}>Casual</button><button onClick={() => selectBattleTab("ranked")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${battleTab === "ranked" ? "bg-red-500/20 text-red-200 ring-1 ring-red-400/30" : "text-muted"}`}>Ranked</button></div></div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{modes.map((item) => <button key={item} onClick={() => setMode(item)} className={`rounded-2xl border p-5 text-left transition ${mode === item ? battleTab === "ranked" ? "border-red-400/50 bg-red-500/10 shadow-lg shadow-red-950/20" : "border-accent bg-accent/10 shadow-lg" : battleTab === "ranked" ? "border-red-400/20 bg-background/40 hover:border-red-400/40" : "border-border bg-background/40 hover:border-accent/30"}`}><p className="text-2xl font-bold text-white">{item}</p><p className="mt-1 text-xs text-muted">{item === "1v1" ? "Solo duel" : item === "15v15" ? "30-player battle" : `${Number(item[0]) * 2} players`}</p></button>)}</div>
      {mode !== "1v1" && battleTab === "casual" && <div className="mt-5 flex rounded-xl border border-border bg-background/50 p-1"><button onClick={() => setTeamMode("regular")} className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold ${teamMode === "regular" ? "bg-white/10 text-white" : "text-muted"}`}>Regular · team average</button><button onClick={() => setTeamMode("captains")} className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold ${teamMode === "captains" ? "bg-accent text-white" : "text-muted"}`}>Captain&apos;s Choice · highest score</button></div>}
      {battleTab === "casual" && <div className="mt-5 rounded-2xl border border-border bg-background/40 p-4"><div><p className="text-sm font-semibold text-white">Casual map pool</p><p className="mt-1 text-xs text-muted">For team battles, the selected pool is calculated from the ranks of everyone who joins the match.</p></div><div className="mt-3 grid gap-2 sm:grid-cols-4">{casualMapModes.map((item) => <button key={item} onClick={() => { setCasualMapMode(item); if (item === "manual" && mapResults.length === 0) void searchMaps(""); }} className={`rounded-xl border px-3 py-2.5 text-xs font-semibold capitalize ${casualMapMode === item ? "border-accent bg-accent/10 text-accent" : "border-border text-muted hover:text-white"}`}>{item === "lowest" ? "Lower rank · random" : item === "middle" ? "Middle rank · random" : item === "highest" ? "Higher rank · random" : "Manual map"}</button>)}</div>{casualMapMode === "manual" && <div className="mt-3"><div className="flex gap-2"><div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-background/50 px-3 py-2"><Search size={15} className="text-muted" /><input value={mapQuery} onChange={(event) => setMapQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void searchMaps(); }} placeholder="Search any map" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none" /></div><button onClick={() => void searchMaps()} className="rounded-xl border border-border px-4 text-xs font-semibold text-white hover:border-accent/40">{searchingMaps ? <Loader2 className="animate-spin" size={15} /> : "Search"}</button></div><div className="mt-2 max-h-40 space-y-1 overflow-y-auto">{mapResults.map((map) => <button key={map.id} onClick={() => setManualMap(map)} className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs ${manualMap?.id === map.id ? "bg-accent/10 text-accent" : "text-white hover:bg-white/5"}`}><span className="truncate">{map.title}</span><span className="ml-3 shrink-0 text-muted">{map.artist ?? ""}</span></button>)}</div>{manualMap && <p className="mt-2 text-xs text-accent">Selected: {manualMap.title}</p>}</div>}</div>}
      {mode !== "1v1" && battleTab === "ranked" && <div className="mt-5 rounded-xl border border-red-400/20 bg-red-500/5 px-4 py-3 text-sm text-red-200">Ranked team battles always use the average accuracy of every player on each team.</div>}
      {error && <p className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}
      <button disabled={queueing} onClick={queue} className={`mt-5 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white disabled:opacity-50 ${battleTab === "ranked" ? "bg-red-600 hover:bg-red-500" : "bg-accent hover:bg-accent2"}`}>{queueing ? <Loader2 className="animate-spin" size={16} /> : <Swords size={16} />} Find {battleTab} match</button>
    </section> : <section className="grid gap-6 lg:grid-cols-[1fr_22rem]"><div className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-xl font-semibold text-white">Open lobbies</h2><p className="mt-1 text-sm text-muted">Join a party and play casual team battles together.</p></div><button disabled={refreshing} onClick={() => void loadLobbies(true)} className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-4 py-2 text-xs font-semibold text-white hover:border-accent/40 disabled:opacity-50"><RefreshCw className={refreshing ? "animate-spin" : ""} size={14} />Refresh lobbies</button></div><div className="mt-5 space-y-2">{lobbies.length === 0 ? <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted">No open lobbies yet.</div> : lobbies.map((lobby) => <Link href={`/battles/lobby/${lobby.id}`} key={lobby.id} className="flex items-center gap-4 rounded-2xl border border-border bg-background/40 p-4 transition hover:border-accent/30 hover:bg-white/[0.03]"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent"><Users size={19} /></div><div className="min-w-0 flex-1"><p className="truncate font-semibold text-white">{lobby.name}</p><p className="mt-1 text-xs text-muted">{lobby.host} · {lobby.mode} · {lobby.matchType}</p></div><span className="text-xs text-muted">{lobby.playerCount}/{lobby.maxPlayers}</span></Link>)}</div></div><div className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow"><p className="text-xs uppercase tracking-[0.2em] text-accent">Party</p><h2 className="mt-1 text-xl font-semibold text-white">Create lobby</h2><div className="mt-5 flex items-center gap-2 rounded-xl border border-border bg-background/50 px-3 py-2"><Search size={16} className="text-muted" /><input value={lobbyName} onChange={(e) => setLobbyName(e.target.value)} placeholder="Party name" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none" /></div><select value={mode} onChange={(e) => setMode(e.target.value)} className="mt-3 w-full rounded-xl border border-border bg-background/50 px-3 py-3 text-sm text-white outline-none">{modes.map((item) => <option key={item}>{item}</option>)}</select><button disabled={creatingLobby || !lobbyName.trim()} onClick={createLobby} className="mt-3 w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"><Plus className="mr-2 inline" size={16} />Create party/lobby</button></div></section>}
  </div>;
}
