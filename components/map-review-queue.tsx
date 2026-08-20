"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, Map as MapIcon, Star, Link2, User as UserIcon } from "lucide-react";

type PendingMap = {
  id: string;
  title: string;
  artist: string | null;
  description: string | null;
  mapFileUrl: string;
  imageUrl: string | null;
  sourceUrl: string | null;
  requestedRating: number;
  mapperName: string | null;
  noteCount: number | null;
  length: number | null;
  createdAt: string;
  submittedBy: { username: string; displayName: string | null; profileHandle: string; avatar: string | null };
};

export function MapReviewQueue({ initialMaps }: { initialMaps: PendingMap[] }) {
  const [maps, setMaps] = useState(initialMaps);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  async function moderate(id: string, status: "approved" | "rejected") {
    setError("");
    setBusyId(id);
    try {
      const response = await fetch(`/api/maps/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, note: rejectNote || null }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not review map.");
      setMaps((current) => current.filter((map) => map.id !== id));
      setRejectingId(null);
      setRejectNote("");
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Could not review map.");
    } finally {
      setBusyId("");
    }
  }

  if (maps.length === 0) return <div className="rounded-3xl border border-border bg-surface/95 p-8 text-sm text-muted">There are no pending map submissions.</div>;

  return (
    <div className="space-y-5">
      {error ? <p className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p> : null}
      {maps.map((map) => {
        const isRejecting = rejectingId === map.id;
        const lengthLabel = map.length != null ? `${Math.floor(map.length / 60_000)}:${String(Math.round((map.length % 60_000) / 1000)).padStart(2, "0")}` : null;
        const submitterName = map.submittedBy.displayName ?? map.submittedBy.username;
        const isRhythiaUrl = Boolean(map.sourceUrl);
        return (
          <article key={map.id} className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="min-w-0">
                <div className="flex items-center gap-2"><span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent"><MapIcon size={18} /></span><p className="text-xs uppercase tracking-[0.25em] text-accent">Map submission</p></div>
                <h2 className="mt-3 text-2xl font-semibold text-white">{map.title}</h2>
                <p className="mt-1 text-sm text-muted">{map.artist ?? "Unknown artist"} · Mapped by {map.mapperName ?? submitterName}</p>
                <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-background/60 p-3">
                  {map.submittedBy.avatar ? <img src={map.submittedBy.avatar} alt={submitterName} className="h-9 w-9 rounded-full border border-accent/30" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-accent"><UserIcon size={16} /></span>}
                  <div className="min-w-0"><p className="truncate text-sm font-semibold text-white">Submitted by <Link href={`/profile/${map.submittedBy.profileHandle}`} className="hover:text-accent">{submitterName}</Link></p><p className="text-xs text-muted">@{map.submittedBy.profileHandle} · {new Date(map.createdAt).toLocaleDateString()}</p></div>
                </div>
                <p className="mt-4 text-sm leading-7 text-muted">{map.description || "No description provided."}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
                  <span className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 font-semibold text-accent"><Star className="h-3 w-3" fill="currentColor" /> {isRhythiaUrl ? "Auto-calculated rating" : "Requested rating"}: {map.requestedRating.toFixed(2)}</span>
                  {map.noteCount != null && <span className="rounded-full border border-border bg-background/60 px-3 py-1">{map.noteCount.toLocaleString()} notes</span>}
                  {lengthLabel && <span className="rounded-full border border-border bg-background/60 px-3 py-1">{lengthLabel}</span>}
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <a href={map.mapFileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent/20"><Download size={15} /> Map file</a>
                  {map.sourceUrl && <a href={map.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-accent/40"><Link2 size={15} /> Rhythia link</a>}
                </div>
              </div>
              <div>{map.imageUrl ? <img src={map.imageUrl} alt={map.title} className="aspect-video w-full rounded-2xl border border-border object-cover" onError={(event) => ((event.currentTarget as HTMLImageElement).style.display = "none")} /> : <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-dashed border-border bg-background/40 text-sm text-muted">No thumbnail provided</div>}</div>
            </div>
            {isRejecting ? (
              <div className="mt-5 rounded-2xl border border-border bg-background/60 p-4">
                <p className="text-sm font-semibold text-white">Reason for rejection</p>
                <textarea value={rejectNote} onChange={(event) => setRejectNote(event.target.value)} rows={3} placeholder="Reason for rejection" className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-white outline-none transition focus:border-accent" />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button disabled={busyId === map.id || rejectNote.trim().length === 0} onClick={() => moderate(map.id, "rejected")} className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-400 disabled:opacity-50">{busyId === map.id ? "Rejecting..." : "Confirm rejection"}</button>
                  <button onClick={() => { setRejectingId(null); setRejectNote(""); }} className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted transition hover:text-white">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background/40 p-4">
                <p className="text-sm text-muted">Approval uses the displayed rating. File uploads use the submitter&apos;s requested rating; Rhythia URL submissions use the star-based calculated rating.</p>
                <div className="flex flex-wrap gap-2">
                  <button disabled={busyId === map.id} onClick={() => moderate(map.id, "approved")} className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50">{busyId === map.id ? "Approving..." : "Approve"}</button>
                  <button disabled={busyId === map.id} onClick={() => { setRejectNote(""); setRejectingId(map.id); }} className="rounded-full border border-red-400/40 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-400/10 disabled:opacity-50">Reject</button>
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
