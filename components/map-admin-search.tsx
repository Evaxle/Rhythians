"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Trash2, Star, Download, ExternalLink } from "lucide-react";

type Completion = {
  id: string;
  passed: boolean;
  points: number;
  accuracy: number | null;
  scoreId: number | null;
  createdAt: string;
  user: { id: string; username: string; displayName: string | null; profileHandle: string };
};

type MapInfo = {
  id: string;
  title: string;
  artist: string | null;
  description: string | null;
  mapFileUrl: string;
  imageUrl: string | null;
  requestedRating: number;
  rating: number | null;
  mapperName: string | null;
  noteCount: number | null;
  length: number | null;
  sourceUrl: string | null;
  isAutoImported: boolean;
  status: string;
  reviewerNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  submittedBy: { id: string; username: string; displayName: string | null; profileHandle: string } | null;
  reviewedBy: { id: string; username: string; displayName: string | null; profileHandle: string } | null;
  completions: Completion[];
};

type SearchResult = {
  id: string;
  title: string;
  artist: string | null;
  status: string;
  rating: number | null;
  requestedRating: number;
  isAutoImported: boolean;
  createdAt: string;
};

const STATUS_STYLES: Record<string, string> = {
  pending: "border-yellow-400/30 bg-yellow-400/10 text-yellow-300",
  approved: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  rejected: "border-red-400/30 bg-red-400/10 text-red-300",
  hidden: "border-blue-400/30 bg-blue-400/10 text-blue-300",
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

export function MapAdminSearch() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removingId, setRemovingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [map, setMap] = useState<MapInfo | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [editRating, setEditRating] = useState("");

  async function search() {
    const value = query.trim();
    if (!value) return;
    setLoading(true);
    setError("");
    setMessage("");
    setMap(null);
    setSearched(false);
    try {
      const response = await fetch(`/api/admin/maps/search?q=${encodeURIComponent(value)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not search maps.");
      setResults(data.maps ?? []);
      if ((data.maps ?? []).length === 1) await loadMap(data.maps[0].id);
      setSearched(true);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Could not search maps.");
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }

  async function loadMap(id: string) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/maps/${encodeURIComponent(id)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load this map.");
      setMap(data.map);
      setEditRating(data.map.rating != null ? String(data.map.rating) : "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load this map.");
    } finally {
      setLoading(false);
    }
  }

  async function saveRating() {
    if (!map) return;
    const rating = Number(editRating);
    if (!Number.isFinite(rating) || rating < 0 || rating > 9.99) {
      setError("Rating must be between 0 and 9.99.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/maps/${map.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not update rating.");
      setMap({ ...map, rating: data.map.rating });
      setMessage(`Rating updated to ${Number(data.map.rating).toFixed(2)}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update rating.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteMap() {
    if (!map) return;
    if (!window.confirm(`Delete "${map.title}"? This removes the map and all its scores permanently.`)) return;
    setDeleting(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/maps/${map.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not delete this map.");
      setMap(null);
      setSearched(true);
      setMessage("Map deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this map.");
    } finally {
      setDeleting(false);
    }
  }

  async function removeCompletion(completionId: string, username: string) {
    if (!map) return;
    if (!window.confirm(`Remove ${username}'s score from this map? Their RHP from this map will be clawed back.`)) return;
    setRemovingId(completionId);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/maps/${map.id}/completions/${completionId}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not remove score.");
      setMap({ ...map, completions: map.completions.filter((c) => c.id !== completionId) });
      setMessage(`Removed score and clawed back ${data.clawedBack} RHP.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove score.");
    } finally {
      setRemovingId("");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <form onSubmit={(event) => { event.preventDefault(); search(); }} className="flex flex-col gap-3 sm:flex-row">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by map name or ID…" className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-white outline-none transition focus:border-accent" />
          <button type="submit" disabled={loading || query.trim().length === 0} className="shrink-0 inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent2 disabled:opacity-50">
            <Search size={16} /> {loading ? "Searching…" : "Search"}
          </button>
        </form>
        <p className="mt-3 text-xs text-muted">Search ranked maps by map name or Rhythians ID.</p>
      </section>

      {results.length > 1 && !map ? (
        <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
          <p className="text-sm font-semibold text-white">{results.length} maps found</p>
          <div className="mt-4 space-y-2">
            {results.map((result) => (
              <button key={result.id} onClick={() => loadMap(result.id)} className="w-full rounded-2xl border border-border bg-background/60 p-4 text-left transition hover:border-accent/50">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-white">{result.title}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_STYLES[result.status] ?? "border-border text-muted"}`}>{result.status}</span>
                </div>
                <p className="mt-1 text-xs text-muted">{result.artist ?? "Unknown artist"} · ID: {result.id}</p>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {error ? <p className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p> : null}
      {message ? <p className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200">{message}</p> : null}

      {searched && results.length === 0 && !loading && !error ? <p className="rounded-3xl border border-border bg-surface/95 p-8 text-sm text-muted">No maps found.</p> : null}

      {map ? (
        <div className="space-y-6">
          <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold text-white">{map.title}</h2>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${STATUS_STYLES[map.status] ?? "border-border bg-white/5 text-muted"}`}>{map.status}</span>
              {map.isAutoImported && <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">Auto-imported</span>}
            </div>
            <p className="mt-1 text-sm text-muted">{map.artist ?? "Unknown artist"}</p>
            <p className="mt-3 text-sm leading-7 text-muted">{map.description || "No description provided."}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={`/maps/${map.id}`} target="_blank" className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-white hover:border-accent/50"><ExternalLink size={15} /> Open map page</Link>
              {map.status === "approved" && <a href={`/api/maps/download?id=${encodeURIComponent(map.id)}`} className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent2"><Download size={15} /> Download SSPM</a>}
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="space-y-3 rounded-3xl border border-border bg-background/60 p-5"><p className="text-xs uppercase tracking-[0.24em] text-accent">Submitted by</p>{map.submittedBy ? <><p className="text-sm text-white">{map.submittedBy.displayName ?? map.submittedBy.username}</p><p className="text-sm text-muted">@{map.submittedBy.profileHandle}</p></> : <p className="text-sm text-muted">—</p>}</div>
              <div className="space-y-3 rounded-3xl border border-border bg-background/60 p-5"><p className="text-xs uppercase tracking-[0.24em] text-accent">Approved by</p>{map.reviewedBy ? <><p className="text-sm text-white">{map.reviewedBy.displayName ?? map.reviewedBy.username}</p><p className="text-sm text-muted">@{map.reviewedBy.profileHandle} · {formatDate(map.reviewedAt)}</p></> : <p className="text-sm text-muted">Not reviewed yet.</p>}</div>
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-4 rounded-3xl border border-border bg-background/60 p-5">
              <label className="block"><span className="text-xs font-semibold text-muted">Current rating</span><input type="number" step="0.01" min="0" max="9.99" value={editRating} onChange={(event) => setEditRating(event.target.value)} className="mt-2 w-40 rounded-xl border border-border bg-background px-3 py-2 text-sm text-white outline-none transition focus:border-accent" /></label>
              <button onClick={saveRating} disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent2 disabled:opacity-50"><Star size={15} /> {saving ? "Saving..." : "Save rating"}</button>
            </div>
            <div className="mt-4 space-y-3 rounded-3xl border border-border bg-background/60 p-5">
              <p className="text-sm font-semibold text-white">Map details</p>
              <p className="break-all text-sm text-muted">ID: <span className="text-white">{map.id}</span></p>
              <p className="break-all text-sm text-muted">Requested rating: <span className="text-white">{map.requestedRating.toFixed(2)}</span></p>
              <p className="break-all text-sm text-muted">Mapper: <span className="text-white">{map.mapperName ?? "—"}</span></p>
              <p className="break-all text-sm text-muted">Notes: <span className="text-white">{map.noteCount?.toLocaleString() ?? "—"}</span></p>
              <p className="break-all text-sm text-muted">Length: <span className="text-white">{map.length ? Math.round(map.length / 1000) + "s" : "—"}</span></p>
              <p className="break-all text-sm text-muted">Created: <span className="text-white">{formatDate(map.createdAt)}</span></p>
              {map.sourceUrl && <a href={map.sourceUrl} target="_blank" rel="noreferrer" className="break-all text-sm text-accent hover:text-white">Source: {map.sourceUrl}</a>}
              {map.reviewerNote && <p className="break-all text-sm text-muted">Reviewer note: <span className="text-white">{map.reviewerNote}</span></p>}
            </div>
          </section>
          <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow"><p className="text-sm font-semibold text-white">Scores ({map.completions.length})</p><p className="mt-1 text-sm text-muted">Remove a player&apos;s score to claw back the RHP they earned from this map.</p>{map.completions.length === 0 ? <p className="mt-4 text-sm text-muted">No scores recorded for this map.</p> : <div className="mt-4 overflow-hidden rounded-2xl border border-border">{map.completions.map((completion) => <div key={completion.id} className="flex flex-wrap items-center gap-3 border-b border-border bg-background/60 px-4 py-3 last:border-0 sm:flex-nowrap"><div className="min-w-0 flex-1"><Link href={`/profile/${completion.user.profileHandle}`} className="truncate text-sm font-semibold text-white hover:text-accent">{completion.user.displayName ?? completion.user.username}</Link><p className="text-xs text-muted">{completion.passed ? "Passed" : "Failed"} · {completion.points} RHP{completion.accuracy != null ? ` · ${completion.accuracy.toFixed(2)}%` : ""} · {formatDate(completion.createdAt)}</p></div><button disabled={removingId === completion.id} onClick={() => removeCompletion(completion.id, completion.user.username)} className="inline-flex items-center gap-2 rounded-full border border-red-400/40 px-3 py-1.5 text-xs font-semibold text-red-200 transition hover:bg-red-400/10 disabled:opacity-50"><Trash2 size={13} /> {removingId === completion.id ? "Removing..." : "Remove score"}</button></div>)}</div>}</section>
          <section className="rounded-3xl border border-red-400/20 bg-red-400/5 p-6 shadow-glow"><p className="text-sm font-semibold text-white">Delete this map</p><p className="mt-1 text-sm text-muted">This permanently removes the map and all its scores. This cannot be undone.</p><button disabled={deleting} onClick={deleteMap} className="mt-4 inline-flex items-center gap-2 rounded-full bg-red-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-400 disabled:opacity-50"><Trash2 size={15} /> {deleting ? "Deleting..." : "Delete map"}</button></section>
        </div>
      ) : null}
    </div>
  );
}
