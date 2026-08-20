"use client";

import { useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";

const STATUS_URL = "http://127.0.0.1:45872/status";

export function RhythKitSettings() {
  const [status, setStatus] = useState<"checking" | "connected" | "not_connected">("checking");
  const [game, setGame] = useState("unknown");

  const check = async () => {
    setStatus("checking");
    try {
      const response = await fetch(STATUS_URL, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = await response.json() as { installed?: boolean; running?: boolean; game?: string };
      if (!data.installed || !data.running) throw new Error();
      setGame(data.game ?? "unknown");
      setStatus("connected");
    } catch {
      setGame("unknown");
      setStatus("not_connected");
    }
  };

  useEffect(() => {
    void check();
    const timer = window.setInterval(() => void check(), 5000);
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
        {status === "connected" && <p className="mt-2 text-sm text-muted">Game: {game}</p>}
        {status === "not_connected" && <p className="mt-2 text-sm text-muted">Install and run RhythKit on this computer, then refresh this page.</p>}
      </div>

      {status === "not_connected" && (
        <a href="https://github.com/Evaxle/RhythKit/releases" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/80">
          <Download size={16} />
          Install RhythKit
        </a>
      )}
    </div>
  );
}
