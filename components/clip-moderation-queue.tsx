"use client";

import { useState } from "react";

type PendingClip = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  storagePath: string;
  uploader: { username: string; discriminator: string };
  category: { name: string };
  videoUrl: string | null;
};

export function ClipModerationQueue({ initialClips }: { initialClips: PendingClip[] }) {
  const [clips, setClips] = useState(initialClips);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  async function moderate(id: string, status: "approved" | "rejected") {
    const rejectionReason = status === "rejected" ? window.prompt("Why is this clip being rejected?")?.trim() ?? "" : "";
    if (status === "rejected" && !rejectionReason) return;
    setError("");
    setBusyId(id);

    try {
      const response = await fetch(`/api/admin/clips/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, rejectionReason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not update clip.");
      setClips((current) => current.filter((clip) => clip.id !== id));
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
      {clips.map((clip) => (
        <article key={clip.id} className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-accent">{clip.category.name}</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">{clip.title}</h2>
              <p className="mt-3 text-sm leading-7 text-muted">{clip.description || "No description provided."}</p>
              <p className="mt-4 text-xs text-muted">Uploaded by {clip.uploader.username}#{clip.uploader.discriminator} on {new Date(clip.createdAt).toLocaleDateString()}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button disabled={busyId === clip.id} onClick={() => moderate(clip.id, "approved")} className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50">Approve</button>
                <button disabled={busyId === clip.id} onClick={() => moderate(clip.id, "rejected")} className="rounded-full border border-red-400/40 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-400/10 disabled:opacity-50">Reject</button>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl bg-black">
              {clip.videoUrl ? <video controls className="aspect-video h-full w-full object-contain" src={clip.videoUrl} /> : <div className="flex aspect-video items-center justify-center px-4 text-center text-sm text-muted">Preview unavailable. Review the submitted storage path: {clip.storagePath}</div>}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
