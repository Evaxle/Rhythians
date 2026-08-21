"use client";

import { useEffect, useRef, useState } from "react";
import { Download, RefreshCw, Wifi, Terminal, Play, Trash2, Server, ExternalLink } from "lucide-react";

const GAMES = [
  { id: "RhythiaSteam", name: "Rhythia Steam", port: 45872 },
  { id: "SspNightly", name: "Sound Space Plus", port: 45873 },
  { id: "Vulnus", name: "Vulnus", port: 45874 },
  { id: "RewriteRhythia", name: "Rewrite Rhythia", port: 45875 },
] as const;

type AgentStatus = {
  installed?: boolean;
  running?: boolean;
  gameRunning?: boolean;
  loggedIn?: boolean;
  connected?: boolean;
  authenticated?: boolean;
  username?: string | null;
  game?: string;
  gameVersion?: string | null;
  integrationConnected?: boolean;
  mapCaptureReady?: boolean;
  mapId?: string | null;
  lastEvent?: string | null;
  lastSeenAt?: string;
  rhythiansServerUrl?: string;
};

type DebugEvent = { timestamp: string; event: string; message: string; game?: string | null; gameVersion?: string | null; mapId?: string | null; data?: unknown };
type GameState = AgentStatus & { state: "checking" | "connected" | "not_connected" };
const initial = (): Record<string, GameState> => Object.fromEntries(GAMES.map(game => [game.id, { state: "checking" }])) as Record<string, GameState>;

export function RhythKitSettings() {
  const [active, setActive] = useState("RhythiaSteam");
  const [games, setGames] = useState<Record<string, GameState>>(initial);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [events, setEvents] = useState<DebugEvent[]>([]);
  const [localServer, setLocalServer] = useState<string | null>(null);
  const launchRequested = useRef(new Set<string>());

  const getGame = () => GAMES.find(game => game.id === active) ?? GAMES[0];
  const getUrl = (path: string) => `http://127.0.0.1:${getGame().port}${path}`;

  const check = async (gameId: string) => {
    const game = GAMES.find(value => value.id === gameId);
    if (!game) return false;
    try {
      const response = await fetch(`http://127.0.0.1:${game.port}/status`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = await response.json() as AgentStatus;
      if (!data.installed || !data.running) throw new Error();
      const authenticated = data.loggedIn === true || data.authenticated === true;
      setGames(current => ({ ...current, [gameId]: { ...data, state: authenticated ? "connected" : "not_connected" } }));
      return true;
    } catch {
      setGames(current => ({ ...current, [gameId]: { state: "not_connected" } }));
      return false;
    }
  };

  const requestAgentStart = async (gameId: string) => {
    const game = GAMES.find(value => value.id === gameId);
    if (!game) return false;
    setConnecting(gameId);
    try {
      const uri = `rhythkit://connect?game=${encodeURIComponent(game.id)}`;
      window.open(uri, "rhythkit-agent", "noopener,noreferrer");
      await new Promise(resolve => window.setTimeout(resolve, 1000));
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline) {
        if (await check(gameId)) return true;
        await new Promise(resolve => window.setTimeout(resolve, 1000));
      }
      return false;
    } catch {
      return false;
    } finally {
      setConnecting(null);
    }
  };

  const startServer = async () => {
    const game = getGame();
    setLocalServer(null);
    await requestAgentStart(game.id);
    try {
      const response = await fetch(`http://127.0.0.1:${game.port}/status`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      setLocalServer(`http://127.0.0.1:${game.port}`);
      await check(active);
      window.open(`http://127.0.0.1:${game.port}/status`, "rhythkit-local-server", "noopener,noreferrer");
    } catch {
      setLocalServer(null);
    }
  };

  const loadEvents = async () => {
    if (!advanced) return;
    try {
      const response = await fetch(getUrl("/debug/events"), { cache: "no-store" });
      if (response.ok) setEvents(await response.json() as DebugEvent[]);
    } catch { }
  };

  const testConnection = async () => {
    setTesting(active);
    try {
      const response = await fetch(getUrl("/test-connection"), { method: "POST" });
      if (!response.ok) await check(active);
    } finally {
      await check(active);
      await loadEvents();
      setTesting(null);
    }
  };

  const clearEvents = async () => {
    try { await fetch(getUrl("/debug/events"), { method: "DELETE" }); setEvents([]); } catch { }
  };

  const connect = async (gameId: string) => {
    const game = GAMES.find(value => value.id === gameId);
    if (!game) return;
    setConnecting(gameId);
    try {
      const agentAvailable = await check(gameId);
      if (!agentAvailable) {
        const started = await requestAgentStart(gameId);
        if (!started || !(await check(gameId))) throw new Error();
      }
      const response = await fetch(`http://127.0.0.1:${game.port}/auth/start`, { method: "POST" });
      if (!response.ok) throw new Error();
      const auth = await response.json() as { verificationUrl?: string; expiresIn?: number };
      if (!auth.verificationUrl) throw new Error();
      window.open(auth.verificationUrl, "_blank", "noopener,noreferrer");
      const deadline = Date.now() + Math.max(30, auth.expiresIn ?? 600) * 1000;
      while (Date.now() < deadline) {
        await new Promise(resolve => window.setTimeout(resolve, 2000));
        const status = await fetch(`http://127.0.0.1:${game.port}/status`, { cache: "no-store" });
        if (!status.ok) continue;
        const data = await status.json() as AgentStatus;
        if (data.loggedIn === true || data.authenticated === true) break;
      }
      await check(gameId);
    } catch {
      await check(gameId);
    } finally {
      setConnecting(null);
    }
  };

  useEffect(() => {
    GAMES.forEach(game => void check(game.id));
    const timer = window.setInterval(() => GAMES.forEach(game => void check(game.id)), 2000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      if (launchRequested.current.has(active)) return;
      launchRequested.current.add(active);
      if (await check(active)) return;
      await requestAgentStart(active);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [active]);

  useEffect(() => {
    void loadEvents();
    const timer = advanced ? window.setInterval(() => void loadEvents(), 1000) : undefined;
    return () => { if (timer) window.clearInterval(timer); };
  }, [advanced, active]);

  const current = games[active] ?? { state: "checking" as const };
  const game = getGame();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div><p className="font-semibold text-white">RhythKit</p><p className="mt-1 text-sm leading-6 text-muted">Connect each installed game integration to your Rhythians account.</p></div>
        <button onClick={() => GAMES.forEach(game => void check(game.id))} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white/5 text-muted transition hover:text-white" aria-label="Refresh RhythKit status"><RefreshCw size={16} /></button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {GAMES.map(value => {
          const state = games[value.id]?.state ?? "checking";
          return <button key={value.id} onClick={() => { setActive(value.id); setLocalServer(null); }} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${active === value.id ? "bg-accent text-white" : "border border-border bg-white/5 text-muted hover:text-white"}`}><span className={`h-2.5 w-2.5 rounded-full ${state === "connected" ? "bg-green-400" : state === "not_connected" ? "bg-red-400" : "bg-yellow-400"}`} />{value.name}</button>;
        })}
      </div>

      <div className="rounded-2xl border border-border bg-background/60 p-5 space-y-4">
        <div><div className="flex items-center gap-3"><span className={`h-3 w-3 rounded-full ${current.state === "connected" ? "bg-green-400" : current.state === "not_connected" ? "bg-red-400" : "bg-yellow-400"}`} /><p className="font-semibold text-white">{current.state === "connected" ? "Rhythians connected" : current.state === "not_connected" ? "Not connected" : "Checking..."}</p></div><p className="mt-2 text-sm text-muted">{current.state === "connected" ? `Connected as ${current.username ?? "your account"}.` : `Install and start RhythKit for ${game.name} to establish the local connection.`}</p></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-white/5 p-4"><p className="text-xs uppercase tracking-[0.2em] text-muted">Game</p><p className="mt-2 font-semibold text-white">{current.gameRunning ? "Running" : "Not running"}</p><p className="mt-1 text-xs text-muted">{current.game ?? game.name}</p></div>
          <div className="rounded-xl border border-border bg-white/5 p-4"><p className="text-xs uppercase tracking-[0.2em] text-muted">Game integration</p><p className="mt-2 font-semibold text-white">{current.integrationConnected ? "Connected" : "Waiting"}</p><p className="mt-1 text-xs text-muted">{current.mapCaptureReady ? "Map capture ready" : "Map capture unavailable"}</p></div>
          <div className="rounded-xl border border-border bg-white/5 p-4"><p className="text-xs uppercase tracking-[0.2em] text-muted">RhythKit login</p><p className="mt-2 font-semibold text-white">{current.state === "connected" ? "Logged in" : "Not logged in"}</p><p className="mt-1 text-xs text-muted">{current.username ?? "No Rhythians account linked"}</p></div>
        </div>
        {(current.mapId || current.lastEvent) && <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-border bg-white/5 p-4"><p className="text-xs uppercase tracking-[0.2em] text-muted">Current map</p><p className="mt-2 break-all font-semibold text-white">{current.mapId ?? "No map detected"}</p></div><div className="rounded-xl border border-border bg-white/5 p-4"><p className="text-xs uppercase tracking-[0.2em] text-muted">Integration event</p><p className="mt-2 font-semibold text-white">{current.lastEvent ?? "No event"}</p></div></div>}
      </div>

      <div className="flex flex-wrap gap-3">
        {current.state === "not_connected" && <><button onClick={() => void connect(active)} disabled={connecting !== null} className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/80 disabled:opacity-50"><Wifi size={16} />{connecting === active ? "Connecting..." : "Connect RhythKit"}</button><a href="https://github.com/Evaxle/RhythKit/releases" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-accent/40"><Download size={16} />Install RhythKit</a></>}
        <button onClick={() => void startServer()} disabled={connecting !== null} className="inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-accent/40 disabled:opacity-50"><Server size={16} />{connecting === active ? "Starting Agent..." : "Start / Connect Agent"}</button>
        <button onClick={() => void testConnection()} disabled={testing !== null || current.state === "checking"} className="inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-accent/40 disabled:opacity-50"><Play size={16} />{testing === active ? "Testing..." : "Test Connection"}</button>
        <button onClick={() => setAdvanced(value => !value)} className="inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-accent/40"><Terminal size={16} />{advanced ? "Close Advanced Settings" : "Advanced Settings"}</button>
      </div>

      {localServer && <div className="rounded-xl border border-border bg-white/5 p-4"><p className="text-xs uppercase tracking-[0.2em] text-muted">Local server</p><p className="mt-2 break-all font-mono text-sm text-white">{localServer}</p><p className="mt-1 text-xs text-muted">The RhythKit Agent is reachable locally. Its saved server endpoint is used for Rhythians requests.</p></div>}
      {!localServer && current.state === "not_connected" && <div className="rounded-xl border border-border bg-white/5 p-4"><p className="text-sm font-semibold text-white">RhythKit agent not detected</p><p className="mt-1 text-sm leading-6 text-muted">Rhythians automatically checks the local agent and attempts the installed RhythKit launcher. Use Start / Connect Agent as the manual failsafe if the automatic connection does not start it.</p><a href="https://github.com/Evaxle/RhythKit/releases" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline"><ExternalLink size={14} />Open RhythKit releases</a></div>}

      {advanced && <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_430px]"><div className="rounded-2xl border border-border bg-background/60 p-5 space-y-3"><p className="font-semibold text-white">Integration diagnostics</p><p className="text-sm text-muted">Live events from {game.name}. The console updates while the game is running.</p><div className="flex gap-2"><button onClick={() => void loadEvents()} className="inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-4 py-2 text-sm font-semibold text-white"><RefreshCw size={14} />Refresh</button><button onClick={() => void clearEvents()} className="inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-4 py-2 text-sm font-semibold text-white"><Trash2 size={14} />Clear</button></div></div><div className="min-h-[520px] overflow-hidden rounded-2xl border border-border bg-black"><div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-green-400" /><span className="text-xs font-semibold uppercase tracking-[0.18em] text-white">Live RhythKit Console</span></div><span className="text-xs text-white/40">{game.name}</span></div><div className="h-[470px] overflow-y-auto p-4 font-mono text-[11px] leading-5 text-green-300">{events.length === 0 ? <div className="text-white/40">Waiting for integration events...</div> : events.slice().reverse().map((event, index) => <div key={`${event.timestamp}-${index}`} className="mb-3 border-b border-white/5 pb-2"><div><span className="text-white/40">[{new Date(event.timestamp).toLocaleTimeString()}]</span> <span className="text-cyan-300">{event.event}</span>{event.mapId && <span className="text-yellow-300"> map={event.mapId}</span>}</div><div className="text-white/70">{event.message}</div>{event.gameVersion && <div className="text-white/40">game={event.game ?? "unknown"} version={event.gameVersion}</div>}{event.data != null && <div className="break-all text-white/40">{JSON.stringify(event.data)}</div>}</div>)}</div></div></div>}
    </div>
  );
}
