"use client";

import { useMemo, useState } from "react";
import { Upload, Calculator, Plus } from "lucide-react";
import { rhpGainForMap, rankIndexForRating } from "@/lib/ranks";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/category-constants";

export function MapCreator() {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [mapperName, setMapperName] = useState("");
  const [rating, setRating] = useState("");
  const [noteCount, setNoteCount] = useState("");
  const [length, setLength] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<"" | Category>("");
  const [categoryLevel, setCategoryLevel] = useState("");
  const [challengeLevel, setChallengeLevel] = useState("");
  const [rhpOverride, setRhpOverride] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const calculatedRhp = useMemo(() => {
    const value = Number(rating);
    if (!Number.isFinite(value) || value < 0 || value > 9.99) return null;
    const duration = length ? Number(length) / 1000 : null;
    return rhpGainForMap(value, 100, null, rankIndexForRating(value), duration);
  }, [rating, length]);

  async function submit() {
    setError(""); setMessage("");
    if (!title.trim()) return setError("Title is required.");
    if (!file) return setError("Choose the .sspm map file.");
    if (!rating || calculatedRhp == null) return setError("Enter a valid rating.");
    if (category && !categoryLevel) return setError("Choose a category level.");
    setBusy(true);
    try {
      const uploadResponse = await fetch("/api/admin/maps/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: file.name, contentType: file.type, fileSize: file.size }) });
      const uploadData = await uploadResponse.json();
      if (!uploadResponse.ok) throw new Error(uploadData.error ?? "Could not prepare the upload.");
      const putResponse = await fetch(uploadData.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
      if (!putResponse.ok) throw new Error("The map file upload failed.");
      const createResponse = await fetch("/api/admin/maps/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.trim(), artist: artist.trim() || null, mapperName: mapperName.trim() || null, mapFileUrl: uploadData.publicUrl, rating: Number(rating), noteCount: noteCount ? Number(noteCount) : null, length: length ? Number(length) : null, category: category || null, categoryLevel: categoryLevel ? Number(categoryLevel) : null, challengeLevel: challengeLevel ? Number(challengeLevel) : null, rhpOverride: rhpOverride ? Number(rhpOverride) : null }) });
      const data = await createResponse.json();
      if (!createResponse.ok) throw new Error(data.error ?? "Could not create the map.");
      const reward = data.rhpOverride ?? data.calculatedRhp;
      setMessage(`Added "${data.map.title}" and approved it. RHP reward: ${reward}.`);
      setTitle(""); setArtist(""); setMapperName(""); setRating(""); setNoteCount(""); setLength(""); setFile(null); setCategory(""); setCategoryLevel(""); setChallengeLevel(""); setRhpOverride("");
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Could not create the map."); } finally { setBusy(false); }
  }

  const input = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-white outline-none focus:border-accent";
  return <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/15 text-accent"><Plus size={20} /></div><div><p className="font-semibold text-white">Add and approve a map</p><p className="text-sm text-muted">Upload the actual map file. Admin-created maps bypass the review queue.</p></div></div>{error && <p className="mt-5 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}{message && <p className="mt-5 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200">{message}</p>}<div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><label><span className="mb-1 block text-xs text-muted">Title *</span><input value={title} onChange={(e) => setTitle(e.target.value)} className={input} /></label><label><span className="mb-1 block text-xs text-muted">Artist</span><input value={artist} onChange={(e) => setArtist(e.target.value)} className={input} /></label><label><span className="mb-1 block text-xs text-muted">Mapper</span><input value={mapperName} onChange={(e) => setMapperName(e.target.value)} className={input} /></label><label><span className="mb-1 block text-xs text-muted">Rating *</span><input type="number" min="0" max="9.99" step="0.01" value={rating} onChange={(e) => setRating(e.target.value)} className={input} /></label><label><span className="mb-1 block text-xs text-muted">Note count</span><input type="number" min="0" value={noteCount} onChange={(e) => setNoteCount(e.target.value)} className={input} /></label><label><span className="mb-1 block text-xs text-muted">Length (ms)</span><input type="number" min="0" value={length} onChange={(e) => setLength(e.target.value)} className={input} /></label><label className="sm:col-span-2 lg:col-span-1"><span className="mb-1 block text-xs text-muted">Map file *</span><input type="file" accept=".sspm,.rhm,.osu,.zip" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-full cursor-pointer rounded-xl border border-border bg-background px-3 py-2 text-sm text-white" /></label><label><span className="mb-1 block text-xs text-muted">Category</span><select value={category} onChange={(e) => setCategory(e.target.value as "" | Category)} className={input}><option value="">None</option>{CATEGORIES.map((value) => <option key={value} value={value}>{CATEGORY_LABELS[value]}</option>)}</select></label><label><span className="mb-1 block text-xs text-muted">Category level</span><select value={categoryLevel} onChange={(e) => setCategoryLevel(e.target.value)} disabled={!category} className={input}><option value="">None</option>{Array.from({ length: 10 }, (_, i) => i + 1).map((level) => <option key={level} value={level}>Level {level}</option>)}</select></label><label><span className="mb-1 block text-xs text-muted">Challenge level</span><select value={challengeLevel} onChange={(e) => setChallengeLevel(e.target.value)} className={input}><option value="">None</option>{Array.from({ length: 10 }, (_, i) => i + 1).map((level) => <option key={level} value={level}>Level {level}</option>)}</select></label></div><div className="mt-5 grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-border bg-background/50 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-white"><Calculator size={16} className="text-accent" /> Calculated RHP</div><p className="mt-2 text-2xl font-bold text-accent">{calculatedRhp ?? "—"}</p><p className="mt-1 text-xs text-muted">Calculated from rating, perfect accuracy, speed 1.0, and map length.</p></div><label className="rounded-2xl border border-border bg-background/50 p-4"><span className="text-sm font-semibold text-white">Admin RHP override</span><input type="number" min="1" max="1000" value={rhpOverride} onChange={(e) => setRhpOverride(e.target.value)} placeholder={calculatedRhp == null ? "Calculated value" : String(calculatedRhp)} className={`${input} mt-3`} /><span className="mt-1 block text-xs text-muted">Leave blank to use the calculated reward.</span></label></div><button onClick={() => void submit()} disabled={busy} className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent2 disabled:opacity-50"><Upload size={16} /> {busy ? "Uploading and adding..." : "Upload, add, and approve"}</button></section>;
}
