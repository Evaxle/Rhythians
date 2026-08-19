"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

export function ProfileScoreRefresh() {
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleRefresh = async () => {
    setChecking(true);
    setMessage(null);
    try {
      const response = await fetch("/api/maps/check-all", { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error ?? "Unable to check your scores.");
      if (body.totalPoints > 0) {
        setMessage({ type: "success", text: `+${body.totalPoints} RHP added from your Rhythia scores` });
      } else {
        setMessage({ type: "success", text: `No new RHP earned from your rank's maps` });
      }
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Unable to check your scores." });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => void handleRefresh()}
        disabled={checking}
        title="Recheck your Rhythia scores"
        aria-label="Refresh my Rhythia scores"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-white transition hover:bg-accent/20 disabled:opacity-50"
      >
        <RefreshCw size={15} className={checking ? "animate-spin" : ""} />
      </button>
      {message && <p className={`max-w-[12rem] text-xs leading-4 ${message.type === "success" ? "text-accent" : "text-red-300"}`}>{message.text}</p>}
    </div>
  );
}
