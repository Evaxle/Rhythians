"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ProfileTagEditor({ tags, selected }: { tags: Array<{ id: string; name: string; slug: string }>; selected: string[] }) {
  const router = useRouter();
  const [value, setValue] = useState(selected.slice(0, 3));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function toggle(id: string) {
    setSaved(false);
    setValue((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 3 ? [...current, id] : current);
  }

  async function save() {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const response = await fetch("/api/profile/tags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tagIds: value }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save your tags.");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your tags.");
    } finally {
      setBusy(false);
    }
  }

  if (tags.length === 0) return <p className="text-sm text-muted">You do not have any tags available to display.</p>;

  return (
    <div className="rounded-2xl border border-border bg-background/60 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white">Profile tags</p>
          <p className="mt-1 text-xs text-muted">Choose up to 3 tags to show on your profile.</p>
        </div>
        <span className="text-xs text-muted">{value.length}/3</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {tags.map((tag) => {
          const active = value.includes(tag.id);
          return <button key={tag.id} type="button" onClick={() => toggle(tag.id)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${active ? "border-accent bg-accent/20 text-accent" : "border-border bg-white/5 text-muted hover:border-accent/50 hover:text-white"}`}>{tag.name}</button>;
        })}
      </div>
      {error && <p className="mt-3 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}
      {saved && <p className="mt-3 text-xs text-emerald-300">Profile tags saved.</p>}
      <button type="button" onClick={save} disabled={busy} className="mt-4 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:bg-accent/80 disabled:opacity-50">{busy ? "Saving..." : "Save changes"}</button>
    </div>
  );
}
