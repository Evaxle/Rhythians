"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";

export function ResetRatingSystem() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function resetAll() {
    if (!window.confirm("Reset EVERY user in the database? This will reset RHP and rank, remove Challenge progress, clear RHP transaction history, and require score recalculation. This cannot be undone.")) return;
    if (!window.confirm("FINAL CONFIRMATION: reset the entire Rhythians rating system now?")) return;

    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/users/reset-rating-system", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Reset failed.");
      setMessage(`Reset complete for ${data.users} users.`);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Reset failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-red-400/30 bg-red-400/5 p-6 shadow-glow">
      <p className="text-sm uppercase tracking-[0.3em] text-red-300">Danger zone</p>
      <h2 className="mt-2 text-xl font-semibold text-white">Reset rating system</h2>
      <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">Reset every user's RHP and rank, remove Challenge progress and RHP transaction history, and mark score imports for recalculation under the new rating and weighting system.</p>
      {message && <p className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200">{message}</p>}
      {error && <p className="mt-4 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}
      <button type="button" onClick={() => void resetAll()} disabled={busy} className="mt-5 inline-flex items-center gap-2 rounded-full bg-red-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-400 disabled:opacity-50">
        <RotateCcw size={16} /> {busy ? "Resetting..." : "Reset everyone"}
      </button>
    </section>
  );
}
