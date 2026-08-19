"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

export function AutoImportedMapCleanup() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function removeAutoImportedMaps() {
    if (!window.confirm("Remove every auto-imported map from Challenge and categories? Manual admin-created maps are not affected. This also removes the auto-imported maps' Challenge-level assignments and score records.")) {
      return;
    }

    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/maps/auto-imported", { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not remove auto-imported maps.");
      setMessage(`Removed ${data.removedMaps} auto-imported Challenge map${data.removedMaps === 1 ? "" : "s"}, ${data.removedCategoryMaps} auto-imported category map${data.removedCategoryMaps === 1 ? "" : "s"}, and ${data.removedAssignments} Challenge-level assignment${data.removedAssignments === 1 ? "" : "s"}.`);
    } catch (cleanupError) {
      setError(cleanupError instanceof Error ? cleanupError.message : "Could not remove auto-imported maps.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-red-400/20 bg-red-400/5 p-6 shadow-glow">
      <p className="text-sm font-semibold text-white">Remove auto-imported maps</p>
      <p className="mt-1 text-sm leading-6 text-muted">Maps imported by the old Rhythia importer are hidden from players. Remove them here to keep only maps you add manually from this admin page.</p>
      {message && <p className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">{message}</p>}
      {error && <p className="mt-4 rounded-2xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
      <button type="button" onClick={() => void removeAutoImportedMaps()} disabled={busy} className="mt-4 inline-flex items-center gap-2 rounded-full bg-red-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-400 disabled:opacity-50">
        <Trash2 size={15} /> {busy ? "Removing..." : "Remove auto-imported maps"}
      </button>
    </section>
  );
}
