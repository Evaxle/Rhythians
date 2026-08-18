"use client";

import { useState } from "react";
import { cameraModeLabel, cameraModeEmoji } from "@/lib/camera-mode";
import { ClipPlayer } from "@/components/clip-player";

type PendingClip = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  storagePath: string;
  cameraMode: string | null;
  uploader: { username: string; discriminator: string; displayName?: string | null };
  category: { name: string } | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
};

export function ClipModerationQueue({
  initialClips,
  apiBase = "/api/admin/clips",
}: {
  initialClips: PendingClip[];
  apiBase?: string;
}) {
  const [clips, setClips] = useState(initialClips);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  async function moderate(id: string, status: "approved" | "rejected", rejectionReason: string) {
    setError("");
    setBusyId(id);

    try {
      const response = await fetch(`${apiBase}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, rejectionReason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not update clip.");
      setClips((current) => current.filter((clip) => clip.id !== id));
      setRejectingId(null);
      setRejectReason("");
    } catch (moderationError) {
      setError(moderationError instanceof Error ? moderationError.message : "Could not update clip.");
    } finally {
      setBusyId("");
    }
  }

  if (clips.length === 0) {
    return <div className="rounded-3xl border border-border bg-surface/95 p-8 text-sm text-muted">There are no pending clip submissions.</div>;
  }

  return (
    <div className="space-y-5">
      {error ? <p className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p> : null}
      {clips.map((clip) => {
        const isRejecting = rejectingId === clip.id;
        return (
          <article key={clip.id} className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs uppercase tracking-[0.25em] text-accent">{clip.category?.name ?? "Uncategorized"}</p>
                  {cameraModeLabel(clip.cameraMode) && (
                    <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                      {cameraModeEmoji(clip.cameraMode)} {cameraModeLabel(clip.cameraMode)}
                    </span>
                  )}
                </div>
                <h2 className="mt-2 text-2xl font-semibold text-white">{clip.title}</h2>
                <p className="mt-3 text-sm leading-7 text-muted">{clip.description || "No description provided."}</p>
                <p className="mt-4 text-xs text-muted">
                  Uploaded by {clip.uploader.displayName ?? clip.uploader.username}#{clip.uploader.discriminator} on {new Date(clip.createdAt).toLocaleDateString()}
                </p>

                {isRejecting ? (
                  <div className="mt-5 rounded-2xl border border-border bg-background/60 p-4">
                    <p className="text-sm font-semibold text-white">Reason for rejection</p>
                    <p className="mt-1 text-xs text-muted">
                      This feedback is sent to the uploader so they know what to change before resubmitting.
                    </p>
                    <textarea
                      value={rejectReason}
                      onChange={(event) => setRejectReason(event.target.value)}
                      rows={3}
                      placeholder="e.g. The audio is out of sync — re-export and resubmit."
                      className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-white outline-none transition focus:border-accent"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        disabled={busyId === clip.id || rejectReason.trim().length === 0}
                        onClick={() => moderate(clip.id, "rejected", rejectReason)}
                        className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-400 disabled:opacity-50"
                      >
                        {busyId === clip.id ? "Rejecting..." : "Confirm rejection"}
                      </button>
                      <button
                        onClick={() => {
                          setRejectingId(null);
                          setRejectReason("");
                        }}
                        className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted transition hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      disabled={busyId === clip.id}
                      onClick={() => moderate(clip.id, "approved", "")}
                      className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      disabled={busyId === clip.id}
                      onClick={() => {
                        setRejectReason("");
                        setRejectingId(clip.id);
                      }}
                      className="rounded-full border border-red-400/40 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-400/10 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
              <div className="overflow-hidden rounded-2xl bg-black">
                {clip.videoUrl ? <ClipPlayer src={clip.videoUrl} /> : <div className="flex aspect-video items-center justify-center px-4 text-center text-sm text-muted">Preview unavailable. Review the submitted storage path: {clip.storagePath}</div>}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
