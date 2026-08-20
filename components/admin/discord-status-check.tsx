"use client";

import { useState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";

export function AdminDiscordStatusCheck() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function checkStatus() {
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/discord/sync", { method: "POST", cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Unable to check Discord server status.");
      setMessage(`${data.matchedUsers ?? 0} users matched, ${data.tagsApplied ?? 0} tags applied, ${data.tagsRemoved ?? 0} tags removed, ${data.markedLeft ?? 0} users marked not in server.`);
    } catch (checkError) {
      setError(checkError instanceof Error ? checkError.message : "Unable to check Discord server status.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <ShieldCheck size={20} />
          </div>
          <div>
            <p className="font-semibold text-white">Discord server status</p>
            <p className="mt-1 text-sm leading-6 text-muted">Check linked players against the Discord server and refresh their Discord role-based website tags.</p>
          </div>
        </div>
        <button type="button" onClick={checkStatus} disabled={loading} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent2 disabled:opacity-50">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          {loading ? "Checking…" : "Check Discord status"}
        </button>
      </div>
      {message ? <p className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">{message}</p> : null}
      {error ? <p className="mt-4 rounded-2xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p> : null}
    </section>
  );
}
