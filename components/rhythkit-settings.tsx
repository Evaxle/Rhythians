"use client";

import { useEffect, useState } from "react";
import { Download, RefreshCw, Wifi } from "lucide-react";

const STATUS_URL = "http://127.0.0.1:45872/status";
const AUTH_URL = "http://127.0.0.1:45872/auth/start";
const POLL_URL = "http://127.0.0.1:45872/auth/poll";

type AgentStatus = {
  installed?: boolean;
  running?: boolean;
  gameRunning?: boolean;
  loggedIn?: boolean;
  connected?: boolean;
  authenticated?: boolean;
  username?: string | null;
  game?: string;
};

export function RhythKitSettings() {
  const [status, setStatus] = useState<"checking" | "connected" | "not_connected">("checking");
  const [loggedIn, setLoggedIn] = useState(false);
  const [gameRunning, setGameRunning] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [game, setGame] = useState("unknown");
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
      setGameRunning(data.gameRunning === true);
      setUsername(data.username ?? null);
      setLoggedIn(authenticated);
      setStatus(connected ? "connected" : "not_connected");
    } catch {
      setGame("unknown");
      setGameRunning(false);
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
      const auth = await response.json() as { deviceCode?: string; verificationUrl?: string; expiresIn?: number };
      if (!auth.deviceCode || !auth.verificationUrl) throw new Error();
      window.open(auth.verificationUrl, "_blank", "noopener,noreferrer");
      const deadline = Date.now() + Math.max(30, auth.expiresIn ?? 600) * 1000;
      while (Date.now() < deadline) {
        await new Promise(resolve => window.setTimeout(resolve, 2000));
        const poll = await fetch(POLL_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceCode: auth.deviceCode }),
          cache: "no-store",
        });
        if (!poll.ok) continue;
        const result = await poll.json() as { status?: string };
        if (result.status === "authorized") {
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

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Rhythia</p>
            <p className="mt-2 font-semibold text-white">{gameRunning ? "Running" : "Not running"}</p>
            <p className="mt-1 text-xs text-muted">{game}</p>
          </div>
          <div className="rounded-xl border border-border bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">RhythKit login</p>
            <p className="mt-2 font-semibold text-white">{loggedIn ? "Logged in" : "Not logged in"}</p>
            <p className="mt-1 text-xs text-muted">{loggedIn && username ? username : "No Rhythians account linked"}</p>
          </div>
        </div>
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
