"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CheckAllRankedMapsButton() {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");

  async function checkAll() {
    setChecking(true);
    setMessage("");
    try {
      const response = await fetch("/api/maps/check-all", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to check your scores.");
      setMessage(`Checked ${data.checked} maps${data.foundScores ? ` · ${data.foundScores} with scores` : ""}${data.newlyCompleted ? ` · ${data.newlyCompleted} awarded` : ""}.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to check your scores.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => void checkAll()}
        disabled={checking}
        className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent/20 disabled:opacity-60"
      >
        <RefreshCw size={15} className={checking ? "animate-spin" : ""} />
        {checking ? "Checking..." : "Check all my maps"}
      </button>
      {message && <span className="text-xs text-muted">{message}</span>}
    </div>
  );
}
