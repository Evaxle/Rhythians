"use client";

import { useState } from "react";
import { cameraModeLabel } from "@/lib/camera-mode";

type ClipInfo = {
  id: string;
  title: string;
  description: string;
  status: string;
  featuredOrder: number | null;
  cameraMode: string | null;
  storagePath: string;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  category: { name: string } | null;
  tags: { tag: { name: string; slug: string } }[];
  uploader: { id: string; username: string; discriminator: string; displayName: string | null };
  reviewedBy: { id: string; username: string; discriminator: string; displayName: string | null } | null;
  _count: { likes: number; views: number; comments: number; coachComments: number };
};

const STATUS_STYLES: Record<string, string> = {
  pending: "border-yellow-400/30 bg-yellow-400/10 text-yellow-300",
  approved: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  rejected: "border-red-400/30 bg-red-400/10 text-red-300",
  hidden: "border-blue-400/30 bg-blue-400/10 text-blue-300",
  deleted: "border-zinc-400/30 bg-zinc-400/10 text-zinc-300",
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <span className="shrink-0 text-xs uppercase tracking-[0.2em] text-accent">{label}</span>
      <span className="break-all text-right text-sm text-white">{value}</span>
    </div>
  );
}

export function ClipAdminSearch() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [clip, setClip] = useState<ClipInfo | null>(null);
  const [searched, setSearched] = useState(false);

  async function search() {
    const id = query.trim();
    if (!id) return;
    setLoading(true);
    setError("");
    setClip(null);
    setSearched(false);
    try {
      const response = await fetch(`/api/admin/clips/${encodeURIComponent(id)}`, { method: "GET" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not find this clip.");
      setClip(data.clip);
      setSearched(true);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Could not find this clip.");
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }

  async function deleteClip() {
    if (!clip) return;
    if (!window.confirm(`Delete "${clip.title}"? This removes it from the site.`)) return;
    setDeleting(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/clips/${encodeURIComponent(clip.id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not delete this clip.");
      setClip({ ...clip, status: data.clip.status });
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete this clip.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            search();
          }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Paste a clip ID (uuid)…"
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-white outline-none transition focus:border-accent"
          />
          <button
            type="submit"
            disabled={loading || query.trim().length === 0}
            className="shrink-0 rounded-2xl bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent2 disabled:opacity-50"
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </form>
      </section>

      {error ? (
        <p className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>
      ) : null}

      {searched && !clip && !loading && !error ? (
        <p className="rounded-3xl border border-border bg-surface/95 p-8 text-sm text-muted">
          No clip found with that ID.
        </p>
      ) : null}

      {clip ? (
        <section className="space-y-6">
          <div className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold text-white">{clip.title}</h2>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${STATUS_STYLES[clip.status] ?? "border-border bg-white/5 text-muted"}`}>
                {clip.status}
              </span>
              {clip.featuredOrder ? (
                <span className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                  Featured #{clip.featuredOrder}
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-sm leading-7 text-muted">{clip.description || "No description provided."}</p>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="space-y-3 rounded-3xl border border-border bg-background/60 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-accent">Uploader (created by)</p>
                <InfoRow label="User" value={`${clip.uploader.displayName ?? clip.uploader.username}#${clip.uploader.discriminator}`} />
                <InfoRow label="User ID" value={clip.uploader.id} />
              </div>
              <div className="space-y-3 rounded-3xl border border-border bg-background/60 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-accent">Reviewer (approved by)</p>
                {clip.reviewedBy ? (
                  <>
                    <InfoRow label="User" value={`${clip.reviewedBy.displayName ?? clip.reviewedBy.username}#${clip.reviewedBy.discriminator}`} />
                    <InfoRow label="User ID" value={clip.reviewedBy.id} />
                    <InfoRow label="Reviewed at" value={formatDate(clip.reviewedAt)} />
                  </>
                ) : (
                  <p className="text-sm text-muted">Not reviewed yet.</p>
                )}
              </div>
            </div>

            <div className="mt-4 space-y-3 rounded-3xl border border-border bg-background/60 p-5">
              <InfoRow label="Clip ID" value={clip.id} />
              <InfoRow label="Created at" value={formatDate(clip.createdAt)} />
              <InfoRow label="Updated at" value={formatDate(clip.updatedAt)} />
              <InfoRow label="Category" value={clip.category?.name ?? "Uncategorized"} />
              <InfoRow label="Camera mode" value={cameraModeLabel(clip.cameraMode) ?? "—"} />
              <InfoRow label="Likes / Views / Comments" value={`${clip._count.likes} / ${clip._count.views} / ${clip._count.comments}`} />
              <InfoRow
                label="Tags"
                value={clip.tags.length ? clip.tags.map((t) => t.tag.name).join(", ") : "None"}
              />
              {clip.rejectionReason && <InfoRow label="Rejection reason" value={clip.rejectionReason} />}
              <InfoRow label="Storage path" value={clip.storagePath} />
            </div>
          </div>

          {clip.status !== "deleted" && (
            <div className="rounded-3xl border border-red-400/20 bg-red-400/5 p-6 shadow-glow">
              <p className="text-sm font-semibold text-white">Delete this clip</p>
              <p className="mt-1 text-sm text-muted">
                This removes the clip from the site so nobody can see it anymore. This cannot be undone.
              </p>
              <button
                disabled={deleting}
                onClick={deleteClip}
                className="mt-4 rounded-full bg-red-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-400 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete clip"}
              </button>
            </div>
          )}

          {clip.status === "deleted" && (
            <p className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200">
              This clip has been deleted and is no longer visible on the site.
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}