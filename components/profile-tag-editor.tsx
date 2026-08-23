"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const categories = [["jumps", "Jumps"], ["stream", "Streams"], ["tech", "Tech"], ["vibro", "Vibro"], ["off_grid", "Off Grid"]] as const;

export function ProfileTagEditor({ tags, selected }: { tags: Array<{ id: string; name: string; slug: string }>; selected: string[] }) {
  const router = useRouter();
  const [value, setValue] = useState(selected.slice(0, 3));
  const [favoriteCategory, setFavoriteCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [error, setError] = useState("");
  const [favoriteError, setFavoriteError] = useState("");
  const [saved, setSaved] = useState(false);
  const [favoriteSaved, setFavoriteSaved] = useState(false);

  useEffect(() => { fetch("/api/profile/favorite-category", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((data) => { if (data?.category) setFavoriteCategory(data.category); }).catch(() => {}); }, []);

  function toggle(id: string) { setSaved(false); setValue((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 3 ? [...current, id] : current); }

  async function save() {
    setBusy(true); setError(""); setSaved(false);
    try { const response = await fetch("/api/profile/tags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tagIds: value }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Could not save your tags."); setSaved(true); router.refresh(); } catch (err) { setError(err instanceof Error ? err.message : "Could not save your tags."); } finally { setBusy(false); }
  }

  async function saveFavoriteCategory() {
    setFavoriteBusy(true); setFavoriteError(""); setFavoriteSaved(false);
    try { const response = await fetch("/api/profile/favorite-category", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: favoriteCategory || null }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Could not save your favorite category."); setFavoriteSaved(true); router.refresh(); } catch (err) { setFavoriteError(err instanceof Error ? err.message : "Could not save your favorite category."); } finally { setFavoriteBusy(false); }
  }

  return <div className="rounded-2xl border border-border bg-background/60 p-4"><div className="flex items-center justify-between gap-4"><div><p className="text-sm font-semibold text-white">Profile tags</p><p className="mt-1 text-xs text-muted">Choose up to 3 tags to show on your profile.</p></div><span className="text-xs text-muted">{value.length}/3</span></div>{tags.length > 0 && <><div className="mt-4 flex flex-wrap gap-2">{tags.map((tag) => { const active = value.includes(tag.id); return <button key={tag.id} type="button" onClick={() => toggle(tag.id)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${active ? "border-accent bg-accent/20 text-accent" : "border-border bg-white/5 text-muted hover:border-accent/50 hover:text-white"}`}>{tag.name}</button>; })}</div><button type="button" onClick={save} disabled={busy} className="mt-4 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:bg-accent/80 disabled:opacity-50">{busy ? "Saving..." : "Save tags"}</button></>}{error && <p className="mt-3 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}{saved && <p className="mt-3 text-xs text-emerald-300">Profile tags saved.</p>}<div className="mt-6 border-t border-border pt-5"><div className="flex items-center justify-between gap-4"><div><p className="text-sm font-semibold text-white">Favorite category</p><p className="mt-1 text-xs text-muted">Choose exactly one category to show beside your profile tags.</p></div><span className="text-xs text-muted">{favoriteCategory ? "1/1" : "0/1"}</span></div><div className="mt-4 flex flex-wrap gap-2">{categories.map(([id, label]) => <button key={id} type="button" onClick={() => { setFavoriteCategory(id); setFavoriteSaved(false); }} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${favoriteCategory === id ? "border-accent bg-accent/20 text-accent" : "border-border bg-white/5 text-muted hover:border-accent/50 hover:text-white"}`}>{label}</button>)}</div><button type="button" onClick={saveFavoriteCategory} disabled={favoriteBusy} className="mt-4 rounded-full border border-accent/40 bg-accent/10 px-5 py-2 text-sm font-semibold text-accent transition hover:bg-accent/20 disabled:opacity-50">{favoriteBusy ? "Saving..." : "Save favorite category"}</button>{favoriteError && <p className="mt-3 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">{favoriteError}</p>}{favoriteSaved && <p className="mt-3 text-xs text-emerald-300">Favorite category saved.</p>}</div></div>;
}
