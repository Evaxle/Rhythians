"use client";

import { useEffect, useState } from "react";
import { Download, RefreshCw, Wifi } from "lucide-react";

const STATUS_URL = "http://127.0.0.1:45872/status";
const AUTH_URL = "http://127.0.0.1:45872/auth/start";

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

export function RhythKitSettings() {
  const [status, setStatus] = useState<"checking" | "connected" | "not_connected">("checking");
  const [loggedIn, setLoggedIn] = useState(false);
  const [gameRunning, setGameRunning] = useState(false);
  const [integrationConnected, setIntegrationConnected] = useState(false);
  const [mapCaptureReady, setMapCaptureReady] = useState(false);
  const [mapId, setMapId] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [game, setGame] = useState("unknown");
  const [gameVersion, setGameVersion] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const check = async () => {
    try {
      const response = await fetch(STATUS_URL, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = await response.json() as AgentStatus;
      if (!data.installed || !data.running) throw new Error();
      const authenticated = data.loggedIn === true || data.authenticated === true;
      const connected = data.connected === true && data.gameRunning === true && authenticated;
      setGame(data.game ?? "unknown");
      setGameVersion(data.gameVersion ?? null);
      setGameRunning(data.gameRunning === true);
      setIntegrationConnected(data.integrationConnected === true);
      setMapCaptureReady(data.mapCaptureReady === true);
      setMapId(data.mapId ?? null);
      setLastEvent(data.lastEvent ?? null);
      setLastSeenAt(data.lastSeenAt ?? null);
      setUsername(data.username ?? null);
      setLoggedIn(authenticated);
      setStatus(connected ? "connected" : "not_connected");
    } catch {
      setGame("unknown");
      setGameVersion(null);
      setGameRunning(false);
      setIntegrationConnected(false);
      setMapCaptureReady(false);
      setMapId(null);
      setLastEvent(null);
      setLastSeenAt(null);
      setUsername(null);
      setLoggedIn(false);
      setStatus("not_connected");
    }
  };

  const connect = async () => {
    setConnecting(true);
    try {
      const response = await fetch(AUTH_URL, { method: "POST" });
      if (!response.ok) throw new Error();
      const auth = await response.json() as { verificationUrl?: string; expiresIn?: number };
      if (!auth.verificationUrl) throw new Error();
      window.open(auth.verificationUrl, "_blank", "noopener,noreferrer");
      const deadline = Date.now() + Math.max(30, auth.expiresIn ?? 600) * 1000;
      while (Date.now() < deadline) {
        await new Promise(resolve => window.setTimeout(resolve, 2000));
        const response = await fetch(STATUS_URL, { cache: "no-store" });
        if (!response.ok) continue;
        const data = await response.json() as AgentStatus;
        if (data.loggedIn === true || data.authenticated === true) {
          await check();
          return;
        }
      }
      throw new Error();
    } catch {
      setStatus("not_connected");
      setLoggedIn(false);
      setUsername(null);
    } finally {
      setConnecting(false);
      void check();
    }
  };

  useEffect(() => {
    void check();
    const timer = window.setInterval(() => void check(), 2000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-white">RhythKit</p>
          <p className="mt-1 text-sm leading-6 text-muted">Connect Rhythia to your Rhythians account and submit eligible completions.</p>
        </div>
        <button onClick={() => void check()} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white/5 text-muted transition hover:text-white" aria-label="Refresh RhythKit status">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-background/60 p-5 space-y-4">
        <div>
          <div className="flex items-center gap-3">
            <span className={`h-3 w-3 rounded-full ${status === "connected" ? "bg-green-400" : status === "not_connected" ? "bg-red-400" : "bg-yellow-400"}`} />
            <p className="font-semibold text-white">
              {status === "connected" ? "Live connection" : status === "not_connected" ? "Not connected" : "Checking..."}
            </p>
          </div>
          <p className="mt-2 text-sm text-muted">
            {status === "connected" ? `Rhythia is running and RhythKit is connected to Rhythians as ${username ?? "your account"}.` : gameRunning ? "Rhythia is running, but RhythKit is not currently connected to Rhythians." : "Start Rhythia with RhythKit installed to establish a live connection."}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Rhythia</p>
            <p className="mt-2 font-semibold text-white">{gameRunning ? "Running" : "Not running"}</p>
            <p className="mt-1 text-xs text-muted">{game}{gameVersion ? ` · ${gameVersion}` : ""}</p>
          </div>
          <div className="rounded-xl border border-border bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Game integration</p>
            <p className="mt-2 font-semibold text-white">{integrationConnected ? "Connected" : "Waiting"}</p>
            <p className="mt-1 text-xs text-muted">{mapCaptureReady ? "Map capture ready" : "Map capture unavailable"}</p>
          </div>
          <div className="rounded-xl border border-border bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">RhythKit login</p>
            <p className="mt-2 font-semibold text-white">{loggedIn ? "Logged in" : "Not logged in"}</p>
            <p className="mt-1 text-xs text-muted">{loggedIn && username ? username : "No Rhythians account linked"}</p>
          </div>
        </div>

        {(mapId || lastEvent || lastSeenAt) && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Current map</p>
              <p className="mt-2 break-all font-semibold text-white">{mapId ?? "No map detected"}</p>
            </div>
            <div className="rounded-xl border border-border bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Integration event</p>
              <p className="mt-2 font-semibold text-white">{lastEvent ?? "No event"}</p>
            </div>
          </div>
        )}
      </div>

      {status === "not_connected" && (
        <div className="flex flex-wrap gap-3">
          <button onClick={() => void connect()} disabled={connecting} className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/80 disabled:opacity-50">
            <Wifi size={16} />
            {connecting ? "Waiting for authorization..." : gameRunning ? "Try connecting again" : "Connect RhythKit"}
          </button>
          <a href="https://github.com/Evaxle/RhythKit/releases" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-accent/40">
            <Download size={16} />
            Install RhythKit
          </a>
        </div>
      )}

      {status === "connected" && <p className="text-xs text-muted">Live status refreshes automatically while this settings page is open.</p>}
    </div>
  );
}
