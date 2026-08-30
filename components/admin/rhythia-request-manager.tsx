"use client";

import { useState } from "react";

export type RhythiaRequest = {
  id: string;
  userId: string;
  username: string;
  profileHandle: string;
  profileId: number;
  profileUrl: string;
  rhythiaUsername: string;
  claimedUsername: string;
  adminNote: string | null;
  createdAt: string;
};

export function RhythiaRequestManager({ initialRequests }: { initialRequests: RhythiaRequest[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function resolve(id: string, action: "approve" | "deny") {
    setBusy(id);
    setError(null);
    const response = await fetch("/api/admin/rhythia-requests", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action, note: notes[id] || undefined }) });
    const data = await response.json().catch(() => null);
    setBusy(null);
    if (!response.ok) {
      setError(data?.error ?? "Unable to resolve request.");
      return;
    }
    setRequests((current) => current.filter((request) => request.id !== id));
  }

  return <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
    <div className="flex items-start justify-between gap-4">
      <div><p className="text-sm uppercase tracking-[0.3em] text-accent">Rhythia verification</p><h2 className="mt-2 text-2xl font-semibold text-white">Manual requests</h2><p className="mt-2 text-sm leading-7 text-muted">Players appear here when automatic bio verification fails and they request manual approval.</p></div>
      <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">{requests.length} pending</span>
    </div>
    {error && <p className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
    <div className="mt-6 space-y-4">
      {requests.length === 0 ? <div className="rounded-2xl border border-dashed border-border bg-background/60 p-6 text-sm text-muted">No pending manual Rhythia requests.</div> : requests.map((request) => <article key={request.id} className="rounded-2xl border border-border bg-background/60 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="font-semibold text-white">{request.username}</p>
            <p className="text-sm text-muted">@{request.profileHandle}</p>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2"><div><span className="text-muted">Claimed account:</span> <span className="text-white">{request.claimedUsername}</span></div><div><span className="text-muted">Rhythia:</span> <span className="text-white">{request.rhythiaUsername}</span></div><div><span className="text-muted">Profile ID:</span> <span className="text-white">{request.profileId}</span></div><div><a href={request.profileUrl} target="_blank" rel="noreferrer" className="font-semibold text-accent hover:text-accent/80">Open Rhythia profile →</a></div></div>
            {request.adminNote && <div className="mt-4 rounded-xl border border-border bg-white/5 p-3"><p className="text-xs uppercase tracking-[0.18em] text-accent">Player note</p><p className="mt-1 text-sm leading-6 text-muted">{request.adminNote}</p></div>}
          </div>
          <div className="w-full lg:max-w-sm"><label className="text-xs uppercase tracking-[0.18em] text-muted">Admin note</label><textarea value={notes[request.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [request.id]: event.target.value }))} rows={3} maxLength={1000} placeholder="Optional note" className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-white outline-none placeholder:text-muted focus:border-accent/50" /><div className="mt-3 flex gap-2"><button disabled={busy === request.id} onClick={() => resolve(request.id, "approve")} className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy === request.id ? "Working..." : "Approve"}</button><button disabled={busy === request.id} onClick={() => resolve(request.id, "deny")} className="flex-1 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-200 disabled:opacity-50">Deny</button></div></div>
        </div>
      </article>)}
    </div>
  </section>;
}
