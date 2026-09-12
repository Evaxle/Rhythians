"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Save, Trash2 } from "lucide-react";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/category-constants";

export type ChallengeAdminTab = "challenge" | Category;

const labels: Record<ChallengeAdminTab, string> = {
  challenge: "Challenge",
  ...CATEGORY_LABELS,
};

export function AdminMapControls({ mapId, currentTab, currentLevel }: { mapId: string; currentTab: ChallengeAdminTab; currentLevel: number }) {
  const router = useRouter();
  const [targetTab, setTargetTab] = useState<ChallengeAdminTab>(currentTab);
  const [targetLevel, setTargetLevel] = useState(currentLevel);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save(nextLevel = targetLevel) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/challenge/manage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromTab: currentTab, tab: targetTab, mapId, level: nextLevel }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to update map assignment.");
      setTargetLevel(nextLevel);
      setMessage(`Saved to ${labels[targetTab]} level ${nextLevel}.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update map assignment.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/challenge/manage", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tab: currentTab, mapId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to remove map from this level.");
      setMessage("Removed from the active level pool.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to remove map from this level.");
    } finally {
      setBusy(false);
    }
  }

  const lower = Math.max(1, targetLevel - 1);
  const higher = Math.min(10, targetLevel + 1);

  return <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-3">
    <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">Admin map controls</p>
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <select value={targetTab} onChange={(event) => setTargetTab(event.target.value as ChallengeAdminTab)} disabled={busy} className="rounded-xl border border-white/10 bg-background px-3 py-2 text-xs text-white outline-none focus:border-accent/60">
        <option value="challenge">Challenge</option>
        {CATEGORIES.map((category) => <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>)}
      </select>
      <select value={targetLevel} onChange={(event) => setTargetLevel(Number(event.target.value))} disabled={busy} className="rounded-xl border border-white/10 bg-background px-3 py-2 text-xs text-white outline-none focus:border-accent/60">
        {Array.from({ length: 10 }, (_, index) => index + 1).map((level) => <option key={level} value={level}>Level {level}</option>)}
      </select>
      <button type="button" onClick={() => void save(lower)} disabled={busy || targetLevel <= 1} className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"><ArrowDown size={13} /> Down</button>
      <button type="button" onClick={() => void save(higher)} disabled={busy || targetLevel >= 10} className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"><ArrowUp size={13} /> Up</button>
      <button type="button" onClick={() => void save()} disabled={busy} className="inline-flex items-center gap-1 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"><Save size={13} /> Save</button>
      <button type="button" onClick={() => void remove()} disabled={busy} className="inline-flex items-center gap-1 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-200 disabled:opacity-40"><Trash2 size={13} /> Remove</button>
    </div>
    {message && <p className="mt-2 text-xs text-muted">{message}</p>}
  </div>;
}
