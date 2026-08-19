"use client";

import { useState } from "react";

const categories = [
  ["jumps", "Jumps"],
  ["stream", "Stream"],
  ["tech", "Tech"],
  ["off_grid", "Off Grid"],
] as const;

export function AdminUserLevels({
  userId,
  challengeLevel,
  categoryLevels,
  profileTitle,
  profileTitleColor,
  canEditTitle,
}: {
  userId: string;
  challengeLevel: number;
  categoryLevels: Array<{ category: string; level: number }>;
  profileTitle: string;
  profileTitleColor: string;
  canEditTitle: boolean;
}) {
  const [mainLevel, setMainLevel] = useState(String(challengeLevel));
  const [levels, setLevels] = useState<Record<string, string>>(() => Object.fromEntries(categoryLevels.map((item) => [item.category, String(item.level)])));
  const [title, setTitle] = useState(profileTitle);
  const [titleColor, setTitleColor] = useState(profileTitleColor || "#a78bfa");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function saveLevels() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/levels`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeLevel: Number(mainLevel),
          categoryLevels: Object.fromEntries(categories.map(([key]) => [key, Number(levels[key] ?? 0)])),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save levels.");
      setMainLevel(String(data.challengeLevel));
      setLevels(Object.fromEntries(data.categoryLevels.map((item: { category: string; level: number }) => [item.category, String(item.level)])));
      setMessage("Levels saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save levels.");
    } finally {
      setBusy(false);
    }
  }

  async function saveTitle() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/profile-title`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, color: titleColor }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save title.");
      setTitle(data.title ?? "");
      setTitleColor(data.color ?? "#a78bfa");
      setMessage("Profile title saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save title.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <div className="rounded-3xl border border-border bg-background/60 p-5">
        <p className="text-xs uppercase tracking-[0.24em] text-accent">Challenge levels</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs text-muted">Main challenge level</span>
            <input type="number" min={0} max={20} value={mainLevel} onChange={(event) => setMainLevel(event.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-white outline-none focus:border-accent" />
          </label>
          {categories.map(([key, label]) => (
            <label key={key} className="block">
              <span className="mb-1 block text-xs text-muted">{label} level</span>
              <input type="number" min={0} max={10} value={levels[key] ?? "0"} onChange={(event) => setLevels((current) => ({ ...current, [key]: event.target.value }))} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-white outline-none focus:border-accent" />
            </label>
          ))}
        </div>
        <button onClick={saveLevels} disabled={busy} className="mt-4 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:bg-accent2 disabled:opacity-50">{busy ? "Saving…" : "Save levels"}</button>
      </div>

      {canEditTitle && (
        <div className="rounded-3xl border border-border bg-background/60 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-accent">Owner-only profile title</p>
          <p className="mt-2 text-xs text-muted">This title appears directly under the user's main profile name. Only the site owner can change it.</p>
          <div className="mt-4 space-y-3">
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={40} placeholder="e.g. Challenge Master" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-white outline-none focus:border-accent" />
            <div className="flex items-center gap-3">
              <input type="color" value={titleColor} onChange={(event) => setTitleColor(event.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-background p-1" />
              <input value={titleColor} onChange={(event) => setTitleColor(event.target.value)} maxLength={7} className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-white outline-none focus:border-accent" />
              <span className="text-sm font-semibold" style={{ color: titleColor }}>{title || "Preview"}</span>
            </div>
          </div>
          <button onClick={saveTitle} disabled={busy} className="mt-4 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:bg-accent2 disabled:opacity-50">{busy ? "Saving…" : "Save profile title"}</button>
        </div>
      )}
      {message && <p className="text-sm text-muted lg:col-span-2">{message}</p>}
    </div>
  );
}
