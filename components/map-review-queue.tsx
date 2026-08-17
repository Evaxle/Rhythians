"use client";

import { useState } from "react";
import { Download, Map as MapIcon } from "lucide-react";

type PendingMap = {
  id: string;
  title: string;
  artist: string | null;
  description: string | null;
  mapFileUrl: string;
  requestedRating: number;
  mapperName: string | null;
  noteCount: number | null;
  length: number | null;
  createdAt: string;
  submittedBy: { username: string; displayName: string | null; profileHandle: string };
};

export function MapReviewQueue({ initialMaps }: { initialMaps: PendingMap[] }) {
  const [maps, setMaps] = useState(initialMaps);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [finalRating, setFinalRating] = useState<string>("");
  const [rejectNote, setRejectNote] = useState("");

  async function moderate(id: string, status: "approved" | "rejected") {
    setError("");
    setBusyId(id);
    try {
      const response = await fetch(`/api/maps/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          finalRating: status === "approved" && finalRating ? Number(finalRating) : null,
          note: rejectNote || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not review map.");
      setMaps((current) => current.filter((map) => map.id !== id));
      setRejectingId(null);
      setRejectNote("");
      setFinalRating("");
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Could not review map.");
    } finally {
      setBusyId("");
    }
  }

  if (maps.length === 0) {
    return <div className="rounded-3xl border border-border bg-surface/95 p-8 text-sm text-muted">There are no pending map submissions.</div>;
  }

  return (
    <div className="space-y-5">
      {error ? <p className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p> : null}
      {maps.map((map) => {
        const isRejecting = rejectingId === map.id;
        const lengthLabel = map.length != null
          ? `${Math.floor(map.length / 60_000)}:${String(Math.round((map.length % 60_000) / 1000)).padStart(2, "0")}`
          : null;
        return (
          <article key={map.id} className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
                    <MapIcon size={18} />
                  </span>
                  <p className="text-xs uppercase tracking-[0.25em] text-accent">Map submission</p>
                </div>
                <h2 className="mt-3 text-2xl font-semibold text-white">{map.title}</h2>
                <p className="mt-1 text-sm text-muted">
                  {map.artist ?? "Unknown artist"} · Mapped by {map.mapperName ?? map.submittedBy.displayName ?? map.submittedBy.username}
                </p>
                <p className="mt-3 text-sm leading-7 text-muted">{map.description || "No description provided."}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
                  <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 font-semibold text-accent">
                    Requested rating: {map.requestedRating.toFixed(2)}
                  </span>
                  {map.noteCount != null && <span className="rounded-full border border-border bg-background/60 px-3 py-1">{map.noteCount.toLocaleString()} notes</span>}
                  {lengthLabel && <span className="rounded-full border border-border bg-background/60 px-3 py-1">{lengthLabel}</span>}
                </div>
                <p className="mt-4 text-xs text-muted">
                  Submitted by {map.submittedBy.displayName ?? map.submittedBy.username} on {new Date(map.createdAt).toLocaleDateString()}
                </p>
              </div>
              <a
                href={map.mapFileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent/20"
              >
                <Download size={15} /> Download map file
              </a>
            </div>

            {isRejecting ? (
              <div className="mt-5 rounded-2xl border border-border bg-background/60 p-4">
                <p className="text-sm font-semibold text-white">Reason for rejection</p>
                <textarea
                  value={rejectNote}
                  onChange={(event) => setRejectNote(event.target.value)}
                  rows={3}
                  placeholder="e.g. The difficulty rating is too high for the chart — resubmit with a more accurate rating."
                  className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-white outline-none transition focus:border-accent"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    disabled={busyId === map.id || rejectNote.trim().length === 0}
                    onClick={() => moderate(map.id, "rejected")}
                    className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-400 disabled:opacity-50"
                  >
                    {busyId === map.id ? "Rejecting..." : "Confirm rejection"}
                  </button>
                  <button
                    onClick={() => {
                      setRejectingId(null);
                      setRejectNote("");
                    }}
                    className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted transition hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-border bg-background/40 p-4 sm:flex-row sm:items-end sm:justify-between">
                <label className="block">
                  <span className="text-xs font-semibold text-muted">Final rating (2 decimals)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="9.99"
                    value={finalRating}
                    onChange={(event) => setFinalRating(event.target.value)}
                    placeholder={map.requestedRating.toFixed(2)}
                    className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-white outline-none transition focus:border-accent sm:w-40"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={busyId === map.id}
                    onClick={() => moderate(map.id, "approved")}
                    className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {busyId === map.id ? "Approving..." : "Approve"}
                  </button>
                  <button
                    disabled={busyId === map.id}
                    onClick={() => {
                      setRejectNote("");
                      setRejectingId(map.id);
                    }}
                    className="rounded-full border border-red-400/40 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-400/10 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}