"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const categories = [
  ["jumps", "Jumps"],
  ["stream", "Streams"],
  ["tech", "Tech"],
  ["vibro", "Vibro"],
  ["off_grid", "Off Grid"],
] as const;

export function FavoriteCategoryEditor({ selected }: { selected: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(selected ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setSaved(false);
    setError("");
    try {
      const response = await fetch("/api/profile/favorite-category", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: value || null }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save favorite category.");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save favorite category.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="rounded-2xl border border-border bg-background/60 p-4"><div className="flex items-center justify-between gap-4"><div><p className="text-sm font-semibold text-white">Favorite category</p><p className="mt-1 text-xs text-muted">Pick the one category you enjoy most.</p></div><span className="text-xs text-muted">{value ? "1/1" : "0/1"}</span></div><div className="mt-4 flex flex-wrap gap-2">{categories.map(([id, label]) => <button key={id} type="button" onClick={() => { setValue(id); setSaved(false); }} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${value === id ? "border-accent bg-accent/20 text-accent" : "border-border bg-white/5 text-muted hover:border-accent/50 hover:text-white"}`}>{label}</button>)}</div>{error && <p className="mt-3 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}{saved && <p className="mt-3 text-xs text-emerald-300">Favorite category saved.</p>}<button type="button" onClick={save} disabled={busy} className="mt-4 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:bg-accent/80 disabled:opacity-50">{busy ? "Saving..." : "Save changes"}</button></div>;
}
