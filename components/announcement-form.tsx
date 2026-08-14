"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type InitialAnnouncement = {
  id: string;
  title: string;
  content: string;
  published: boolean;
  pinned: boolean;
};

export function AnnouncementForm({ initial }: { initial?: InitialAnnouncement }) {
  const router = useRouter();
  const isEditing = Boolean(initial);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [published, setPublished] = useState(initial?.published ?? false);
  const [pinned, setPinned] = useState(initial?.pinned ?? false);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("saving");
    setError("");
    try {
      const url = isEditing ? `/api/admin/announcements/${initial!.id}` : "/api/admin/announcements";
      const response = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, published, pinned }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save announcement.");
      router.push("/admin/announcements");
      router.refresh();
    } catch (submitError) {
      setStatus("error");
      setError(submitError instanceof Error ? submitError.message : "Could not save announcement.");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {status === "error" ? (
        <p className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>
      ) : null}

      <div>
        <label className="mb-2 block text-sm font-medium text-white" htmlFor="announcement-title">Title</label>
        <input
          id="announcement-title"
          type="text"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-white outline-none transition focus:border-accent/50"
          placeholder="e.g. New season is live"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-white" htmlFor="announcement-content">Content</label>
        <textarea
          id="announcement-content"
          required
          rows={10}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-7 text-white outline-none transition focus:border-accent/50"
          placeholder="Write the announcement. Separate paragraphs with a blank line."
        />
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex cursor-pointer items-center gap-3 text-sm text-muted">
          <input
            type="checkbox"
            checked={published}
            onChange={(event) => setPublished(event.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Published (visible to the community)
        </label>
        <label className="flex cursor-pointer items-center gap-3 text-sm text-muted">
          <input
            type="checkbox"
            checked={pinned}
            onChange={(event) => setPinned(event.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Pin to the top
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={status === "saving"}
          className="inline-flex items-center rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:bg-accent2 disabled:opacity-50"
        >
          {status === "saving" ? "Saving…" : isEditing ? "Save changes" : "Create announcement"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/announcements")}
          className="inline-flex items-center rounded-full border border-border bg-white/5 px-5 py-2 text-sm text-muted transition hover:border-accent/40 hover:text-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
