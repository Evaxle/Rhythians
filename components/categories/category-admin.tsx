"use client";

import { useState } from "react";
import { CheckCircle2, Download, Plus, XCircle } from "lucide-react";
import { CATEGORIES, CATEGORY_LABELS, MAX_CATEGORY_LEVEL, type Category } from "@/lib/categories";

type AdminMap = {
  id: string;
  category: Category;
  level: number;
  title: string;
  artist: string | null;
  mapFileUrl: string;
  mapperName: string | null;
  noteCount: number | null;
  length: number | null;
  sourceBeatmapId: number | null;
  status: string;
  reviewerNote: string | null;
  createdAt: string;
  submittedBy: { username: string; displayName: string | null; profileHandle: string };
  reviewedBy: { username: string; displayName: string | null; profileHandle: string } | null;
};

const STATUS_STYLES: Record<string, string> = {
  pending: "border-yellow-400/30 bg-yellow-400/10 text-yellow-300",
  approved: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  rejected: "border-red-400/30 bg-red-400/10 text-red-300",
  hidden: "border-blue-400/30 bg-blue-400/10 text-blue-300",
};

export function CategoryAdmin({ initialMaps }: { initialMaps: AdminMap[] }) {
  const [maps, setMaps] = useState(initialMaps);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [form, setForm] = useState({
    category: "jumps" as Category,
    level: "1",
    title: "",
    artist: "",
    mapFileUrl: "",
    imageUrl: "",
    mapperName: "",
    noteCount: "",
    length: "",
    sourceBeatmapId: "",
    sourceUrl: "",
  });

  async function addMap() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          level: Number(form.level),
          noteCount: form.noteCount ? Number(form.noteCount) : null,
          length: form.length ? Number(form.length) : null,
          sourceBeatmapId: form.sourceBeatmapId ? Number(form.sourceBeatmapId) : null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not add the map.");
      setMaps((current) => [data.map, ...current]);
      setMessage(`Added "${data.map.title}" — it's live now.`);
      setForm({ ...form, title: "", artist: "", mapFileUrl: "", imageUrl: "", mapperName: "", noteCount: "", length: "", sourceBeatmapId: "", sourceUrl: "" });
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Could not add the map.");
    } finally {
      setBusy(false);
    }
  }

  async function moderate(id: string, status: "approved" | "rejected" | "hidden") {
    setBusyId(id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not update the map.");
      setMaps((current) => current.map((map) => (map.id === id ? { ...map, status: data.map.status } : map)));
      setMessage(`Map marked as ${status}.`);
    } catch (modError) {
      setError(modError instanceof Error ? modError.message : "Could not update the map.");
    } finally {
      setBusyId("");
    }
  }

  const inputClass = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-white outline-none focus:border-accent";

  return (
    <div className="space-y-6">
      {error ? <p className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p> : null}
      {message ? <p className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200">{message}</p> : null}

      <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <Plus size={20} />
          </div>
          <div>
            <p className="font-semibold text-white">Add a category map</p>
            <p className="text-sm text-muted">Category maps are curated manually — added maps go live immediately for players to check.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Category</span>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Category })} className={inputClass}>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Level (1-{MAX_CATEGORY_LEVEL})</span>
            <input type="number" min={1} max={MAX_CATEGORY_LEVEL} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Title *</span>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Artist</span>
            <input value={form.artist} onChange={(e) => setForm({ ...form, artist: e.target.value })} className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Mapper name</span>
            <input value={form.mapperName} onChange={(e) => setForm({ ...form, mapperName: e.target.value })} className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Map file URL *</span>
            <input value={form.mapFileUrl} onChange={(e) => setForm({ ...form, mapFileUrl: e.target.value })} className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Image URL</span>
            <input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Note count</span>
            <input type="number" min={0} value={form.noteCount} onChange={(e) => setForm({ ...form, noteCount: e.target.value })} className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Length (ms)</span>
            <input type="number" min={0} value={form.length} onChange={(e) => setForm({ ...form, length: e.target.value })} className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Source beatmap ID</span>
            <input type="number" min={0} value={form.sourceBeatmapId} onChange={(e) => setForm({ ...form, sourceBeatmapId: e.target.value })} className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Source URL</span>
            <input value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} className={inputClass} />
          </label>
        </div>

        <button
          onClick={addMap}
          disabled={busy || !form.title.trim() || !form.mapFileUrl.trim()}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent2 disabled:opacity-50"
        >
          <Plus size={16} /> {busy ? "Adding..." : "Add map"}
        </button>
      </section>

      <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
        <p className="font-semibold text-white">All category maps ({maps.length})</p>
        <div className="mt-4 space-y-3">
          {maps.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-background/50 p-6 text-sm text-muted">No category maps yet.</p>
          ) : (
            maps.map((map) => (
              <div key={map.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[map.status] ?? ""}`}>{map.status}</span>
                    <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">
                      {CATEGORY_LABELS[map.category]} · Level {map.level}
                    </span>
                  </div>
                  <p className="mt-2 truncate text-sm font-semibold text-white">{map.title}</p>
                  <p className="text-xs text-muted">
                    {map.artist ?? "Unknown artist"} · by {map.mapperName ?? map.submittedBy.displayName ?? map.submittedBy.username}
                    {map.noteCount != null ? ` · ${map.noteCount.toLocaleString()} notes` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <a href={map.mapFileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition hover:border-accent/40">
                    <Download size={13} /> Map
                  </a>
                  {map.status !== "approved" && (
                    <button
                      onClick={() => moderate(map.id, "approved")}
                      disabled={busyId === map.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
                    >
                      <CheckCircle2 size={13} /> Approve
                    </button>
                  )}
                  {map.status !== "rejected" && (
                    <button
                      onClick={() => moderate(map.id, "rejected")}
                      disabled={busyId === map.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-400 disabled:opacity-50"
                    >
                      <XCircle size={13} /> Reject
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
