"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

type Status = {
  status: "ok" | "no_profile";
  currentRp: number;
  target: number;
  credited: number;
  rhp: number;
  rankName: string;
  lastCheckedAt: string | null;
};

// Manual "check now" panel for the Rhythia RP → RHP credit. Shows the user's
// current RP, what it weighs to, and how much they've already been credited.
// The button forces a re-check (bypassing the 24h auto-gate) and pays out any
// gain from their RP growing.
export function RhythiaRpCheckButton() {
  const [status, setStatus] = useState<Status | null>(null);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/rhythia/rp-check", { cache: "no-store" });
      const body = await response.json();
      if (response.ok && body.status === "ok") setStatus(body);
    } catch {
      // Best-effort; the button still works.
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleCheck = async () => {
    setChecking(true);
    setMessage(null);
    try {
      const response = await fetch("/api/rhythia/rp-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error ?? "Unable to check your Rhythia RP.");
      if (body.awarded > 0) {
        setMessage({ type: "success", text: `+${body.awarded} RHP from your Rhythia RP (now ${body.target} RHP total).` });
      } else {
        setMessage({ type: "success", text: "Your Rhythia RP credit is up to date." });
      }
      await loadStatus();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Unable to check your Rhythia RP." });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">Rhythia RP → RHP credit</p>
        <button
          type="button"
          onClick={() => void handleCheck()}
          disabled={checking}
          className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:bg-accent/80 disabled:opacity-50"
        >
          <RefreshCw size={13} className={checking ? "animate-spin" : ""} />
          {checking ? "Checking..." : "Check & update now"}
        </button>
      </div>

      {status && (
        <div className="grid gap-2 text-xs text-muted sm:grid-cols-2">
          <p>
            Rhythia RP: <span className="font-semibold text-white">{status.currentRp.toLocaleString()}</span>
          </p>
          <p>
            Weighs to: <span className="font-semibold text-white">{status.target.toLocaleString()} RHP</span>
          </p>
          <p>
            Credited so far: <span className="font-semibold text-white">{status.credited.toLocaleString()} RHP</span>
          </p>
          <p>
            Your rank: <span className="font-semibold text-white">{status.rankName}</span>
          </p>
        </div>
      )}

      {message && (
        <p className={`text-xs ${message.type === "success" ? "text-accent" : "text-red-300"}`}>{message.text}</p>
      )}
    </div>
  );
}
