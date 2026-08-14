"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Announcement = {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  pinned: boolean;
  createdAt: string;
};

export function AnnouncementList({ initialAnnouncements }: { initialAnnouncements: Announcement[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  async function update(id: string, data: Record<string, unknown>) {
    setError("");
    setBusyId(id);
    try {
      const response = await fetch(`/api/admin/announcements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not update announcement.");
      router.refresh();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update announcement.");
    } finally {
      setBusyId("");
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this announcement? This cannot be undone.")) return;
    setError("");
    setBusyId(id);
    try {
      const response = await fetch(`/api/admin/announcements/${id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not delete announcement.");
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete announcement.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="space-y-5">
      {error ? <p className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p> : null}
      {initialAnnouncements.length === 0 ? (
        <div className="rounded-3xl border border-border bg-surface/95 p-8 text-sm text-muted">
          No announcements yet. Create your first announcement above.
        </div>
      ) : (
        initialAnnouncements.map((announcement) => (
          <article key={announcement.id} className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  {announcement.pinned ? (
                    <span className="rounded-full border border-accent/40 bg-accent/10 px-3 py-0.5 text-xs font-medium text-accent">Pinned</span>
                  ) : null}
                  {announcement.published ? (
                    <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-0.5 text-xs font-medium text-emerald-200">Published</span>
                  ) : (
                    <span className="rounded-full border border-border bg-white/5 px-3 py-0.5 text-xs text-muted">Draft</span>
                  )}
                  <span className="text-xs text-muted">{new Date(announcement.createdAt).toLocaleDateString()}</span>
                </div>
                <h2 className="mt-3 text-xl font-semibold text-white">{announcement.title}</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/admin/announcements/${announcement.id}`}
                  className="rounded-full border border-border bg-white/5 px-4 py-1.5 text-sm text-muted transition hover:border-accent/40 hover:text-white"
                >
                  Edit
                </Link>
                <button
                  disabled={busyId === announcement.id}
                  onClick={() => update(announcement.id, { published: !announcement.published })}
                  className="rounded-full border border-border bg-white/5 px-4 py-1.5 text-sm text-muted transition hover:border-accent/40 hover:text-white disabled:opacity-50"
                >
                  {announcement.published ? "Unpublish" : "Publish"}
                </button>
                <button
                  disabled={busyId === announcement.id}
                  onClick={() => update(announcement.id, { pinned: !announcement.pinned })}
                  className="rounded-full border border-border bg-white/5 px-4 py-1.5 text-sm text-muted transition hover:border-accent/40 hover:text-white disabled:opacity-50"
                >
                  {announcement.pinned ? "Unpin" : "Pin"}
                </button>
                <button
                  disabled={busyId === announcement.id}
                  onClick={() => remove(announcement.id)}
                  className="rounded-full border border-red-400/40 px-4 py-1.5 text-sm text-red-200 transition hover:bg-red-400/10 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          </article>
        ))
      )}
    </div>
  );
}
