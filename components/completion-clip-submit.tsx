"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_LABELS, CATEGORIES, type Category } from "@/lib/category-constants";

const levels = [7, 8, 9, 10];
const input = "w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-white outline-none focus:border-accent";

export function CompletionClipSubmit({ kind, category, level, username, uploadedAt }: { kind: "category" | "challenge"; category?: Category; level: number; username: string; uploadedAt: string }) {
  const router = useRouter();
  const [selectedLevel, setSelectedLevel] = useState(String(level));
  const [selectedCategory, setSelectedCategory] = useState<Category | "">(category ?? "");
  const [mapName, setMapName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    const targetLevel = Number(selectedLevel);
    if (!file) return setError("Choose a video file.");
    if (!mapName.trim()) return setError("Map name is required.");
    if (!["video/mp4", "video/webm", "video/quicktime"].includes(file.type)) return setError("Video must be MP4, WebM, or MOV.");
    if (kind === "category" && !selectedCategory) return setError("Choose a category.");
    setBusy(true);
    try {
      const upload = await fetch("/api/completion-clips/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: file.name, contentType: file.type }) });
      const uploadData = await upload.json();
      if (!upload.ok) throw new Error(uploadData.error ?? "Could not prepare the upload.");
      const put = await fetch(uploadData.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!put.ok) throw new Error("Video upload failed.");
      const response = await fetch("/api/completion-clips/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, category: selectedCategory || null, level: targetLevel, mapName: mapName.trim(), storagePath: uploadData.path }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Submission failed.");
      setMessage("Completion submitted for review.");
      setFile(null);
      setMapName("");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Submission failed.");
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="space-y-6 rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
    <div className="grid gap-4 sm:grid-cols-2">
      {kind === "category" ? <label><span className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">Category</span><select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value as Category)} className={input}>{CATEGORIES.map((value) => <option key={value} value={value}>{CATEGORY_LABELS[value]}</option>)}</select></label> : <div><span className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">Category</span><div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-white">Challenge</div></div>}
      <label><span className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">Level</span><select value={selectedLevel} onChange={(e) => setSelectedLevel(e.target.value)} className={input}>{levels.map((value) => <option key={value} value={value}>Level {value}</option>)}</select></label>
      <div><span className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">Username</span><div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-white">{username}</div></div>
      <div><span className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">Date uploaded</span><div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-white">{uploadedAt}</div></div>
    </div>
    <label><span className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">Map name</span><input value={mapName} onChange={(e) => setMapName(e.target.value)} maxLength={160} className={input} placeholder="Enter the map name" /></label>
    <label><span className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">Completion video</span><input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-full cursor-pointer rounded-2xl border border-border bg-background px-4 py-3 text-sm text-white" /><p className="mt-2 text-xs text-muted">Upload the full completion proof video.</p></label>
    {error && <p className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
    {message && <p className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{message}</p>}
    <button disabled={busy} className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Uploading…" : "Submit completion"}</button>
  </form>;
}
