"use client";

import { useState } from "react";
import { Flag } from "lucide-react";

const REPORT_REASONS = [
  "Spam or advertising",
  "Harassment or hate",
  "Inappropriate content",
  "Impersonation",
  "Broken or misleading content",
  "Map is not ranked",
  "Other",
];

export function ReportButton({
  targetType,
  targetId,
  targetLabel,
  reasons = REPORT_REASONS,
}: {
  targetType: "user" | "clip" | "challenge_map";
  targetId: string;
  targetLabel: string;
  reasons?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "busy" | "done">("idle");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setStatus("busy");
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, reason, description }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not submit your report.");
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit your report.");
      setStatus("idle");
    }
  }

  if (status === "done") {
    return <p className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">Report submitted. Thanks for keeping Rhythians safe.</p>;
  }

  return (
    <div>
      {open ? (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-3xl border border-border bg-background/70 p-4">
          <p className="text-sm font-medium text-white">Report {targetLabel}</p>
          <select value={reason} onChange={(event) => setReason(event.target.value)} required className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-white outline-none transition focus:border-accent">
            <option value="" disabled>Select a reason...</option>
            {reasons.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="Anything else we should know? (optional)" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-white outline-none transition focus:border-accent" />
          {error && <p className="text-sm text-red-300">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={status === "busy"} className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-400 disabled:opacity-50">{status === "busy" ? "Submitting..." : "Submit report"}</button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-border px-4 py-2 text-sm text-muted transition hover:text-white">Cancel</button>
          </div>
        </form>
      ) : (
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-4 py-2 text-sm text-muted transition hover:border-red-400/40 hover:text-red-200">
          <Flag className="h-4 w-4" />
          Report
        </button>
      )}
    </div>
  );
}
