"use client";

import { useEffect, useState } from "react";
import { Loader2, Trash2, Save } from "lucide-react";

export function MessageSettings() {
  const [retentionDays, setRetentionDays] = useState(30);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pruning, setPruning] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/messages/settings", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        setRetentionDays(data.retentionDays ?? 30);
        setLoaded(true);
      })
      .catch(() => {
        setRetentionDays(30);
        setLoaded(true);
      });
  }, []);

  async function saveRetention() {
    setSaving(true);
    setStatus("");
    setError("");
    try {
      const response = await fetch("/api/messages/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retentionDays }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save settings.");
      setStatus("Message retention updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function pruneNow() {
    setPruning(true);
    setStatus("");
    setError("");
    try {
      const response = await fetch("/api/messages/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prune: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not prune messages.");
      setStatus("Old messages deleted based on the retention window.");
    } catch (pruneError) {
      setError(pruneError instanceof Error ? pruneError.message : "Could not prune messages.");
    } finally {
      setPruning(false);
    }
  }

  if (!loaded) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted">
        <Loader2 size={16} className="animate-spin" /> Loading message settings...
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-border bg-background/70 p-6">
      <p className="text-sm uppercase tracking-[0.24em] text-accent">Message retention</p>
      <p className="mt-2 text-sm leading-6 text-muted">
        Messages older than this many days are automatically deleted from the history. Applies to all direct messages and group chats.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={3650}
            value={retentionDays}
            onChange={(event) => setRetentionDays(Number(event.target.value))}
            className="w-28 rounded-2xl border border-border bg-surface px-4 py-2 text-sm text-white outline-none transition focus:border-accent"
          />
          <span className="text-sm text-muted">days</span>
        </div>
        <button
          type="button"
          onClick={saveRetention}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent2 disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
        </button>
        <button
          type="button"
          onClick={pruneNow}
          disabled={pruning}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-4 py-2 text-sm font-semibold text-muted transition hover:border-accent/40 hover:text-white disabled:opacity-50"
        >
          {pruning ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Delete old messages now
        </button>
      </div>
      {status && <p className="mt-3 text-sm text-accent">{status}</p>}
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
    </div>
  );
}
