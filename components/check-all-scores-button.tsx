"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

export function CheckAllScoresButton() {
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleCheck = async () => {
    setChecking(true);
    setMessage(null);
    try {
      const response = await fetch("/api/maps/check-all", { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error ?? "Unable to check your scores.");
      const parts: string[] = [];
      parts.push(`Checked ${body.checked} ranked map${body.checked === 1 ? "" : "s"}`);
      parts.push(`found ${body.foundScores} previous passing score${body.foundScores === 1 ? "" : "s"}`);
      setMessage({ type: "success", text: `${parts.join(" · ")}. No legacy challenge levels or completions were changed.` });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Unable to check your scores." });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => void handleCheck()}
        disabled={checking}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/80 disabled:opacity-50"
      >
        <RefreshCw size={16} className={checking ? "animate-spin" : ""} />
        {checking ? "Scanning all ranked maps..." : "Check all ranked maps"}
      </button>
      {message && (
        <p className={`text-sm ${message.type === "success" ? "text-accent" : "text-red-300"}`}>{message.text}</p>
      )}
    </div>
  );
}
