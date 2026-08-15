"use client";

import { useState } from "react";
import { CheckCircle2, ExternalLink, XCircle } from "lucide-react";

interface RequestItem {
  id: string;
  profileId: number;
  profileUrl: string;
  rhythiaUsername: string;
  claimedUsername: string;
  status: "pending" | "approved" | "denied";
  adminNote: string | null;
  createdAt: string;
  user: { id: string; username: string; discriminator: string; profileHandle: string; avatar: string | null };
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "border-amber-400/30 bg-amber-400/10 text-amber-300" },
  approved: { label: "Approved", className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" },
  denied: { label: "Denied", className: "border-red-400/30 bg-red-400/10 text-red-300" },
};

export function RhythiaRequestsManager({ initialRequests }: { initialRequests: RequestItem[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [denyFor, setDenyFor] = useState<string | null>(null);
  const [denyMessage, setDenyMessage] = useState("");

  async function reload() {
    const response = await fetch("/api/admin/rhythia-requests", { cache: "no-store" });
    const data = await response.json();
    setRequests(data.requests);
  }

  async function runAction(id: string, action: "approve" | "deny", message?: string) {
    setError("");
    setBusyId(id);
    try {
      const response = await fetch(`/api/admin/rhythia-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, message }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Action failed.");
      setDenyFor(null);
      setDenyMessage("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusyId("");
    }
  }

  const pendingCount = requests.filter((request) => request.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{pendingCount} pending request{pendingCount === 1 ? "" : "s"}</p>
      </div>

      {error && <p className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}

      {requests.length === 0 ? (
        <div className="rounded-3xl border border-border bg-surface/95 p-10 text-center text-sm text-muted">
          No Rhythia profile link requests yet.
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => {
            const status = STATUS_LABEL[request.status];
            return (
              <article key={request.id} className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${status.className}`}>
                        {status.label}
                      </span>
                      <span className="rounded-full border border-border bg-white/5 px-2.5 py-0.5 text-xs text-muted">
                        Submitted {new Date(request.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="mt-3 text-lg font-semibold text-white">
                      {request.user.username}
                      <span className="font-normal text-muted"> #{request.user.discriminator}</span>
                    </h3>
                    <p className="mt-1 text-sm text-muted">
                      @{request.user.profileHandle} ({request.claimedUsername}) requested to link
                    </p>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <div className="rounded-2xl border border-border bg-background/60 p-3 text-sm">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted">Rhythia profile</p>
                        <a href={request.profileUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-white transition hover:text-accent">
                          {request.rhythiaUsername} <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <div className="rounded-2xl border border-border bg-background/60 p-3 text-sm">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted">Account username</p>
                        <p className="mt-1 text-white">{request.claimedUsername}</p>
                      </div>
                    </div>

                    {request.adminNote && (
                      <p className="mt-3 rounded-2xl border border-border bg-background/60 p-3 text-sm text-muted">
                        {request.adminNote}
                      </p>
                    )}
                  </div>

                  {request.status === "pending" && (
                    <div className="flex shrink-0 flex-col gap-2 lg:w-56">
                      <button
                        onClick={() => runAction(request.id, "approve")}
                        disabled={busyId === request.id}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
                      >
                        <CheckCircle2 size={16} /> {busyId === request.id ? "Linking..." : "Approve"}
                      </button>
                      {denyFor === request.id ? (
                        <div className="space-y-2 rounded-2xl border border-border bg-background/60 p-3">
                          <textarea
                            value={denyMessage}
                            onChange={(event) => setDenyMessage(event.target.value)}
                            rows={2}
                            placeholder="Message sent to the user..."
                            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-white outline-none transition focus:border-accent"
                          />
                          <div className="flex gap-2">
                            <button
                              disabled={busyId === request.id}
                              onClick={() => runAction(request.id, "deny", denyMessage)}
                              className="rounded-full bg-red-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-400 disabled:opacity-50"
                            >
                              Deny request
                            </button>
                            <button
                              onClick={() => setDenyFor(null)}
                              className="rounded-full border border-border px-3 py-1.5 text-xs text-muted transition hover:text-white"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setDenyFor(request.id); setDenyMessage(""); }}
                          disabled={busyId === request.id}
                          className="inline-flex items-center justify-center gap-2 rounded-full border border-red-400/40 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                        >
                          <XCircle size={16} /> Deny
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
