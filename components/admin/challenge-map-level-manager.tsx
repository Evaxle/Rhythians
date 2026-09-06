"use client";

import { useState } from "react";
import { CheckCircle2, Download, Eye, EyeOff, Save } from "lucide-react";

const MAX_LEVEL = 10;
type ChallengeMap = { id: string; title: string; artist: string | null; mapFileUrl: string; rating: number | null; status: string; level: number | null; visible: boolean };

export function ChallengeMapLevelManager({ initialMaps }: { initialMaps: ChallengeMap[] }) {
  const [maps, setMaps] = useState(initialMaps);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function update(id: string, patch: { level?: number | null; visible?: boolean }) {
    setBusyId(id); setMessage(""); setError("");
    try {
      const response = await fetch(`/api/admin/challenge/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not update the map.");
      setMaps((current) => current.map((map) => map.id === id ? { ...map, ...(data.level !== undefined ? { level: data.level } : {}), ...(data.visible !== undefined ? { visible: data.visible } : {}) } : map));
      setMessage(data.message ?? "Challenge map updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update the map.");
    } finally { setBusyId(""); }
  }

  return <div className="space-y-4">{message && <p className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200">{message}</p>}{error && <p className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}{maps.length === 0 ? <div className="rounded-3xl border border-dashed border-border bg-background/50 p-8 text-sm text-muted">No Challenge maps exist yet.</div> : maps.map((map) => <div key={map.id} className="ui-card flex flex-col gap-4 rounded-3xl p-5 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">{map.status}</span><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${map.visible ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" : "border-white/10 bg-white/5 text-muted"}`}>{map.visible ? "Visible" : "Hidden"}</span>{map.rating != null && <span className="rounded-full border border-border bg-white/5 px-2.5 py-1 text-xs text-muted">Rating {map.rating.toFixed(2)}</span>}</div><h2 className="mt-2 truncate text-base font-semibold text-white">{map.title}</h2><p className="text-sm text-muted">{map.artist ?? "Unknown artist"}</p></div><div className="flex flex-wrap items-center gap-2"><a href={map.mapFileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-4 py-2 text-sm font-semibold text-white"><Download size={15} /> Map</a><button type="button" disabled={busyId === map.id} onClick={() => void update(map.id, { visible: !map.visible })} className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${map.visible ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-white/5 text-muted"}`}>{map.visible ? <Eye size={15} /> : <EyeOff size={15} />}{map.visible ? "Visible" : "Hidden"}</button><select value={map.level == null ? "" : String(map.level)} onChange={(event) => void update(map.id, { level: event.target.value ? Number(event.target.value) : null })} disabled={busyId === map.id} className="rounded-full border border-border bg-background px-4 py-2 text-sm text-white outline-none focus:border-accent disabled:opacity-50"><option value="">Not assigned</option>{Array.from({ length: MAX_LEVEL }, (_, index) => index + 1).map((level) => <option key={level} value={level}>Level {level}</option>)}</select>{busyId === map.id ? <span className="inline-flex items-center gap-2 text-xs text-muted"><Save size={14} /> Saving...</span> : <CheckCircle2 size={16} className="text-emerald-300" />}</div></div>)}</div>;
}
