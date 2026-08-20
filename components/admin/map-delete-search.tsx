"use client";

import { useState } from "react";
import { Search, Trash2 } from "lucide-react";

type MapResult = {
  id: string;
  title: string;
  artist: string | null;
  status: string;
};

export function MapDeleteSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MapResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function search() {
    const value = query.trim();
    if (!value) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/maps/search?q=${encodeURIComponent(value)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not search maps.");
      setResults(data.maps ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not search maps.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteMap(map: MapResult) {
    if (!window.confirm(`Delete "${map.title}"? This permanently removes the map and all of its scores.`)) return;
    setDeleting(map.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/maps/${encodeURIComponent(map.id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not delete this map.");
      setResults((current) => current.filter((item) => item.id !== map.id));
      setMessage(`Deleted "${map.title}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this map.");
    } finally {
      setDeleting("");
    }
  }

  return (
    <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-red-300">Delete maps</p>
        <h2 className="mt-3 text-2xl font-semibold text-white">Search maps to delete</h2>
        <p className="mt-2 text-sm text-muted">Search by map name or Rhythians ID, then delete the exact map from the results.</p>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); search(); }} className="mt-5 flex flex-col gap-3 sm:flex-row">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Map name or Rhythians ID…" className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-white outline-none focus:border-accent" />
        <button type="submit" disabled={loading || !query.trim()} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"><Search size={16} />{loading ? "Searching…" : "Search"}</button>
      </form>
      {error ? <p className="mt-4 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p> : null}
      {message ? <p className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200">{message}</p> : null}
      {results.length > 0 ? <div className="mt-5 space-y-2">{results.map((map) => <div key={map.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-background/60 p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-semibold text-white">{map.title}</p><p className="mt-1 text-xs text-muted">{map.artist ?? "Unknown artist"} · ID: {map.id} · {map.status}</p></div><button type="button" onClick={() => deleteMap(map)} disabled={deleting === map.id} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-red-500 px-4 py-2 text-xs font-semibold text-white hover:bg-red-400 disabled:opacity-50"><Trash2 size={14} />{deleting === map.id ? "Deleting…" : "Delete"}</button></div>)}</div> : null}
    </section>
  );
}
