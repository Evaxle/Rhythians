"use client";

import { useEffect, useState } from "react";
import { Download, RefreshCw, Wifi } from "lucide-react";

const GAMES = [
  { id: "RhythiaSteam", name: "Rhythia Steam", port: 45872 },
  { id: "SspNightly", name: "Sound Space Plus", port: 45873 },
  { id: "Vulnus", name: "Vulnus", port: 45874 },
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
};

type GameState = AgentStatus & { state: "checking" | "connected" | "not_connected" };

const initial = (): Record<string, GameState> => Object.fromEntries(GAMES.map(game => [game.id, { state: "checking" }])) as Record<string, GameState>;

export function RhythKitSettings() {
  const [active, setActive] = useState("RhythiaSteam");
  const [games, setGames] = useState<Record<string, GameState>>(initial);
  const [connecting, setConnecting] = useState<string | null>(null);

  const check = async (gameId: string) => {
    const game = GAMES.find(value => value.id === gameId);
    if (!game) return;
    try {
      const response = await fetch(`http://127.0.0.1:${game.port}/status`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = await response.json() as AgentStatus;
      if (!data.installed || !data.running) throw new Error();
      const authenticated = data.loggedIn === true || data.authenticated === true;
      setGames(current => ({ ...current, [gameId]: { ...data, state: authenticated ? "connected" : "not_connected" } }));
    } catch {
      setGames(current => ({ ...current, [gameId]: { state: "not_connected" } }));
    }
  };

  const connect = async (gameId: string) => {
    const game = GAMES.find(value => value.id === gameId);
    if (!game) return;
    setConnecting(gameId);
    try {
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

  const current = games[active] ?? { state: "checking" as const };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-white">RhythKit</p>
          <p className="mt-1 text-sm leading-6 text-muted">Connect each installed game integration to your Rhythians account.</p>
        </div>
        <button onClick={() => GAMES.forEach(game => void check(game.id))} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white/5 text-muted transition hover:text-white" aria-label="Refresh RhythKit status">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {GAMES.map(game => {
          const state = games[game.id]?.state ?? "checking";
          return (
            <button key={game.id} onClick={() => setActive(game.id)} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${active === game.id ? "bg-accent text-white" : "border border-border bg-white/5 text-muted hover:text-white"}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${state === "connected" ? "bg-green-400" : state === "not_connected" ? "bg-red-400" : "bg-yellow-400"}`} />
              {game.name}
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-border bg-background/60 p-5 space-y-4">
        <div>
          <div className="flex items-center gap-3">
            <span className={`h-3 w-3 rounded-full ${current.state === "connected" ? "bg-green-400" : current.state === "not_connected" ? "bg-red-400" : "bg-yellow-400"}`} />
            <p className="font-semibold text-white">{current.state === "connected" ? "Rhythians connected" : current.state === "not_connected" ? "Not connected" : "Checking..."}</p>
          </div>
          <p className="mt-2 text-sm text-muted">
            {current.state === "connected" ? `Connected as ${current.username ?? "your account"}.` : `Install and start RhythKit for ${GAMES.find(game => game.id === active)?.name ?? "this game"} to establish the local connection.`}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Game</p>
            <p className="mt-2 font-semibold text-white">{current.gameRunning ? "Running" : "Not running"}</p>
            <p className="mt-1 text-xs text-muted">{current.game ?? GAMES.find(game => game.id === active)?.name}</p>
          </div>
          <div className="rounded-xl border border-border bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Game integration</p>
            <p className="mt-2 font-semibold text-white">{current.integrationConnected ? "Connected" : "Waiting"}</p>
            <p className="mt-1 text-xs text-muted">{current.mapCaptureReady ? "Map capture ready" : "Map capture unavailable"}</p>
          </div>
          <div className="rounded-xl border border-border bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">RhythKit login</p>
            <p className="mt-2 font-semibold text-white">{current.state === "connected" ? "Logged in" : "Not logged in"}</p>
            <p className="mt-1 text-xs text-muted">{current.username ?? "No Rhythians account linked"}</p>
          </div>
        </div>

        {(current.mapId || current.lastEvent) && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Current map</p>
              <p className="mt-2 break-all font-semibold text-white">{current.mapId ?? "No map detected"}</p>
            </div>
            <div className="rounded-xl border border-border bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Integration event</p>
              <p className="mt-2 font-semibold text-white">{current.lastEvent ?? "No event"}</p>
            </div>
          </div>
        )}
      </div>

      {current.state === "not_connected" && (
        <div className="flex flex-wrap gap-3">
          <button onClick={() => void connect(active)} disabled={connecting !== null} className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/80 disabled:opacity-50">
            <Wifi size={16} />
            {connecting === active ? "Waiting for authorization..." : "Connect RhythKit"}
          </button>
          <a href="https://github.com/Evaxle/RhythKit/releases" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-accent/40">
            <Download size={16} />
            Install RhythKit
          </a>
        </div>
      )}
    </div>
  );
}
