"use client";

import { useState } from "react";

type FeaturedClip = {
  id: string;
  title: string;
  createdAt: string;
  featuredOrder: number | null;
  uploader: { username: string; discriminator: string };
  category: { name: string } | null;
};

function FeaturedSlot({
  label,
  value,
  onChange,
  clips,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  clips: FeaturedClip[];
}) {
  const clip = clips.find((item) => item.id === value) ?? null;
  return (
    <div className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
      <p className="text-xs uppercase tracking-[0.24em] text-accent">{label}</p>
      {clip ? (
        <div className="mt-4">
          <h3 className="text-lg font-semibold text-white">{clip.title}</h3>
          <p className="mt-1 text-sm text-muted">
            {clip.uploader.username}#{clip.uploader.discriminator}
            {clip.category ? ` · ${clip.category.name}` : ""}
          </p>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">No clip selected yet.</p>
      )}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-4 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-white outline-none transition focus:border-accent/50"
      >
        <option value="">Select a clip…</option>
        {clips.map((clip) => (
          <option key={clip.id} value={clip.id}>
            {clip.title} — {clip.uploader.username}#{clip.uploader.discriminator}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FeaturedClipsManager({
  initialClips,
  initialFeatured,
}: {
  initialClips: FeaturedClip[];
  initialFeatured: string[];
}) {
  const [primaryId, setPrimaryId] = useState(initialFeatured[0] ?? "");
  const [secondaryId, setSecondaryId] = useState(initialFeatured[1] ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  async function save() {
    if (primaryId && primaryId === secondaryId) {
      setStatus("error");
      setError("The two featured clips must be different.");
      return;
    }
    setStatus("saving");
    setError("");
    try {
      const response = await fetch("/api/admin/featured-clips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryId: primaryId || null, secondaryId: secondaryId || null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save featured clips.");
      setStatus("saved");
    } catch (saveError) {
      setStatus("error");
      setError(saveError instanceof Error ? saveError.message : "Could not save featured clips.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <FeaturedSlot label="Featured clip 1" value={primaryId} onChange={setPrimaryId} clips={initialClips} />
        <FeaturedSlot label="Featured clip 2" value={secondaryId} onChange={setSecondaryId} clips={initialClips} />
      </div>

      {status === "saved" ? (
        <p className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200">Featured clips saved.</p>
      ) : null}
      {status === "error" ? (
        <p className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          disabled={status === "saving"}
          onClick={save}
          className="inline-flex items-center rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:bg-accent2 disabled:opacity-50"
        >
          {status === "saving" ? "Saving…" : "Save featured clips"}
        </button>
        <button
          disabled={status === "saving"}
          onClick={() => {
            setPrimaryId("");
            setSecondaryId("");
            setStatus("idle");
            setError("");
          }}
          className="inline-flex items-center rounded-full border border-border bg-white/5 px-5 py-2 text-sm text-muted transition hover:border-accent/40 hover:text-white disabled:opacity-50"
        >
          Clear selection
        </button>
      </div>

      <div className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
        <p className="text-xs uppercase tracking-[0.24em] text-accent">Available approved clips ({initialClips.length})</p>
        <div className="mt-4 grid gap-3">
          {initialClips.length === 0 ? (
            <p className="text-sm text-muted">No approved clips are available to feature yet.</p>
          ) : (
            initialClips.map((clip) => (
              <div key={clip.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background/70 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-white">{clip.title}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {clip.uploader.username}#{clip.uploader.discriminator}
                    {clip.category ? ` · ${clip.category.name}` : ""} · {new Date(clip.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {clip.featuredOrder ? (
                  <span className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                    Featured #{clip.featuredOrder}
                  </span>
                ) : (
                  <span className="rounded-full border border-border bg-white/5 px-3 py-1 text-xs text-muted">Not featured</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
