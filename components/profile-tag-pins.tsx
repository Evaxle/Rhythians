"use client";

import { useState } from "react";

type Tag = { name: string; slug: string };

export function ProfileTagPins({ tags, initialPinned }: { tags: Tag[]; initialPinned: string[] }) {
  const [pinned, setPinned] = useState(initialPinned.slice(0, 3));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function toggle(slug: string) {
    const next = pinned.includes(slug) ? pinned.filter((item) => item !== slug) : pinned.length < 3 ? [...pinned, slug] : pinned;
    if (next.length === pinned.length && !pinned.includes(slug)) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/profile/tag-pins", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pinnedTagSlugs: next }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save pinned tags.");
      setPinned(data.pinnedTagSlugs ?? next);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Could not save pinned tags.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="mt-6 rounded-2xl border border-border bg-background/50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold text-white">Public profile tags</p><p className="mt-1 text-xs text-muted">Pin up to three. Unpinned slots automatically use your other tags.</p></div><span className="text-xs text-muted">{pinned.length}/3 pinned</span></div><div className="mt-4 flex flex-wrap gap-2">{tags.map((tag) => <button key={tag.slug} type="button" disabled={saving} onClick={() => void toggle(tag.slug)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${pinned.includes(tag.slug) ? "border-accent/50 bg-accent/15 text-accent" : "border-border bg-white/5 text-muted hover:border-accent/40 hover:text-white"}`}>{pinned.includes(tag.slug) ? "Pinned · " : ""}{tag.name}</button>)}</div>{error && <p className="mt-3 text-xs text-red-300">{error}</p>}</div>;
}
