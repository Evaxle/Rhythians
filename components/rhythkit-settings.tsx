"use client";

import { useEffect, useState } from "react";
import { Download, RefreshCw, Wifi } from "lucide-react";

const STATUS_URL = "http://127.0.0.1:45872/status";
const AUTH_URL = "http://127.0.0.1:45872/auth/start";

export function RhythKitSettings() {
  const [status, setStatus] = useState<"checking" | "connected" | "not_connected">("checking");
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [game, setGame] = useState("unknown");
  const [connecting, setConnecting] = useState(false);

  const check = async () => {
    setStatus("checking");
    try {
      const response = await fetch(STATUS_URL, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = await response.json() as { installed?: boolean; running?: boolean; authenticated?: boolean; username?: string | null; game?: string };
      if (!data.installed || !data.running) throw new Error();
      setGame(data.game ?? "unknown");
      setUsername(data.username ?? null);
      setAuthenticated(data.authenticated === true && Boolean(data.username));
      setStatus(data.authenticated === true && Boolean(data.username) ? "connected" : "not_connected");
    } catch {
      setGame("unknown");
      setUsername(null);
      setAuthenticated(false);
      setStatus("not_connected");
    }
  };

  const connect = async () => {
    setConnecting(true);
    try {
      const response = await fetch(AUTH_URL, { method: "POST" });
      if (!response.ok) throw new Error();
    } catch {
      setStatus("not_connected");
    } finally {
      setConnecting(false);
      void check();
    }
  };

  useEffect(() => {
    void check();
    const timer = window.setInterval(() => void check(), 3000);
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

      <div className="rounded-2xl border border-border bg-background/60 p-5">
        <div className="flex items-center gap-3">
          <span className={`h-3 w-3 rounded-full ${status === "connected" ? "bg-green-400" : status === "not_connected" ? "bg-red-400" : "bg-yellow-400"}`} />
          <p className="font-semibold text-white">
            {status === "connected" ? "Connected" : status === "not_connected" ? "Not connected" : "Checking..."}
          </p>
        </div>
        {status === "connected" && <p className="mt-2 text-sm text-muted">RhythKit is authenticated as <span className="font-semibold text-white">{username}</span>. Game: {game}</p>}
        {status === "not_connected" && <p className="mt-2 text-sm text-muted">Start Rhythia with RhythKit installed, then connect your account.</p>}
      </div>

      {status === "not_connected" && (
        <div className="flex flex-wrap gap-3">
          <button onClick={() => void connect()} disabled={connecting} className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/80 disabled:opacity-50">
            <Wifi size={16} />
            {connecting ? "Connecting..." : "Connect RhythKit"}
          </button>
          <a href="https://github.com/Evaxle/RhythKit/releases" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-accent/40">
            <Download size={16} />
            Install RhythKit
          </a>
        </div>
      )}

      {authenticated && <p className="text-xs text-muted">Connection is verified against Rhythians automatically while this page is open.</p>}
    </div>
  );
}
