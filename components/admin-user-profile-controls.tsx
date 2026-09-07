"use client";

import { useMemo, useState } from "react";

const categories = [["jumps", "Jumps"], ["stream", "Stream"], ["tech", "Tech"], ["off_grid", "Off Grid"]] as const;
const editablePointSystems = [["rpl", "RPL · Lock"], ["rps", "RPS · Spin"], ["rpv", "RPV · VR"], ["rbp", "RBP · Battles"]] as const;

type Data = {
  challengeLevel: number;
  categoryLevels: Array<{ category: string; level: number }>;
  profileTitle: string;
  profileTitleColor: string;
  profileTitleNeon: boolean;
  canEditTitle: boolean;
  points: { rhp: number; rpl: number; rps: number; rpv: number; rbp: number };
};

export function AdminUserProfileControls({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [mainLevel, setMainLevel] = useState("0");
  const [levels, setLevels] = useState<Record<string, string>>({});
  const [points, setPoints] = useState<Record<string, string>>({});
  const [title, setTitle] = useState("");
  const [titleColor, setTitleColor] = useState("#a78bfa");
  const [titleNeon, setTitleNeon] = useState(false);

  const derivedRhp = useMemo(() => {
    const rpl = Number(points.rpl ?? 0);
    const rps = Number(points.rps ?? 0);
    const rpv = Number(points.rpv ?? 0);
    return [rpl, rps, rpv].every(Number.isFinite) ? Math.max(0, Math.round(rpl) + Math.round(rps) + Math.round(rpv)) : 0;
  }, [points.rpl, points.rps, points.rpv]);

  async function toggle() {
    if (open) { setOpen(false); return; }
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/levels`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not load profile controls.");
      setData(result);
      setMainLevel(String(result.challengeLevel ?? 0));
      setLevels(Object.fromEntries((result.categoryLevels ?? []).map((item: { category: string; level: number }) => [item.category, String(item.level)])));
      setPoints(Object.fromEntries(editablePointSystems.map(([key]) => [key, String(result.points?.[key] ?? 0)])));
      setTitle(result.profileTitle ?? "");
      setTitleColor(result.profileTitleColor ?? "#a78bfa");
      setTitleNeon(result.profileTitleNeon === true);
      setOpen(true);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load profile controls.");
    } finally { setLoading(false); }
  }

  async function saveProgression() {
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/levels`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeLevel: Number(mainLevel),
          categoryLevels: Object.fromEntries(categories.map(([key]) => [key, Number(levels[key] ?? 0)])),
          points: Object.fromEntries(editablePointSystems.map(([key]) => [key, Number(points[key] ?? 0)])),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save progression.");
      setMainLevel(String(result.challengeLevel ?? mainLevel));
      setLevels(Object.fromEntries((result.categoryLevels ?? []).map((item: { category: string; level: number }) => [item.category, String(item.level)])));
      setPoints(Object.fromEntries(editablePointSystems.map(([key]) => [key, String(result.points?.[key] ?? 0)])));
      setData((current) => current ? { ...current, challengeLevel: result.challengeLevel, categoryLevels: result.categoryLevels, points: result.points } : current);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save progression.");
    } finally { setSaving(false); }
  }

  async function saveTitle() {
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/profile-title`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, color: titleColor, neon: titleNeon }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save title.");
      setTitle(result.title ?? ""); setTitleColor(result.color ?? "#a78bfa"); setTitleNeon(result.neon === true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save title.");
    } finally { setSaving(false); }
  }

  return <div className="mt-4">
    <button onClick={() => void toggle()} disabled={loading} className="rounded-full border border-border bg-white/5 px-4 py-2 text-xs font-semibold text-white transition hover:border-accent/40 disabled:opacity-50">{loading ? "Loading…" : open ? "Close profile editor" : "Edit profile, levels & points"}</button>
    {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
    {open && data && <div className="mt-4 space-y-4">
      <div className="rounded-2xl border border-border bg-background/60 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-accent">Point systems</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-accent/30 bg-accent/10 px-3 py-2">
            <span className="mb-1 block text-xs text-muted">RHP · Total</span>
            <p className="text-sm font-semibold text-white">{derivedRhp.toLocaleString()}</p>
            <p className="mt-1 text-[11px] text-muted">RPL + RPS + RPV</p>
          </div>
          {editablePointSystems.map(([key, label]) => <label key={key} className="block"><span className="mb-1 block text-xs text-muted">{label}</span><input type="number" min={0} max={1000000} value={points[key] ?? "0"} onChange={(event) => setPoints((current) => ({ ...current, [key]: event.target.value }))} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-white outline-none focus:border-accent" /></label>)}
        </div>
        <p className="mt-3 text-xs leading-5 text-muted">RHP is calculated automatically from RPL + RPS + RPV when you save. RBP is battle-only and never contributes to RHP.</p>
      </div>
      <div className="rounded-2xl border border-border bg-background/60 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-accent">Challenge levels</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2"><span className="mb-1 block text-xs text-muted">Main challenge level</span><input type="number" min={0} max={20} value={mainLevel} onChange={(event) => setMainLevel(event.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-white outline-none focus:border-accent" /></label>
          {categories.map(([key, label]) => <label key={key} className="block"><span className="mb-1 block text-xs text-muted">{label} level</span><input type="number" min={0} max={10} value={levels[key] ?? "0"} onChange={(event) => setLevels((current) => ({ ...current, [key]: event.target.value }))} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-white outline-none focus:border-accent" /></label>)}
        </div>
        <button onClick={() => void saveProgression()} disabled={saving} className="mt-4 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:bg-accent2 disabled:opacity-50">{saving ? "Saving…" : "Save levels & points"}</button>
      </div>
      {data.canEditTitle && <div className="rounded-2xl border border-border bg-background/60 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-accent">Owner-only title</p>
        <p className="mt-1 text-xs text-muted">Shown directly under the main username on the public profile.</p>
        <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={40} placeholder="Profile title" className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-white outline-none focus:border-accent" />
        <div className="mt-3 flex flex-wrap items-center gap-2"><input type="color" value={titleColor} onChange={(event) => setTitleColor(event.target.value)} className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-background p-1" /><input value={titleColor} onChange={(event) => setTitleColor(event.target.value)} maxLength={7} className="w-28 rounded-xl border border-border bg-background px-3 py-2 text-sm text-white outline-none focus:border-accent" /><label className="flex items-center gap-2 rounded-xl border border-border bg-white/5 px-3 py-2 text-xs font-semibold text-white"><input type="checkbox" checked={titleNeon} onChange={(event) => setTitleNeon(event.target.checked)} /> Neon</label><span className="text-sm font-semibold" style={{ color: titleColor, textShadow: titleNeon ? `0 0 5px ${titleColor}, 0 0 14px ${titleColor}, 0 0 28px ${titleColor}` : undefined }}>{title || "Preview"}</span></div>
        <button onClick={() => void saveTitle()} disabled={saving} className="mt-4 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:bg-accent2 disabled:opacity-50">{saving ? "Saving…" : "Save title"}</button>
      </div>}
    </div>}
  </div>;
}
