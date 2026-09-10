"use client";

import { useState } from "react";
import { RANKS } from "@/lib/ranks";
import type { RankingConfig, RankingResetPreviewRow } from "@/lib/ranking-system";

type Props = { initialConfig: RankingConfig; initialRows: RankingResetPreviewRow[]; initialSummary: { users: number; ranks: Record<string, number>; min: number; max: number } };

export function RankingSystemControls({ initialConfig, initialRows, initialSummary }: Props) {
  const [config, setConfig] = useState(initialConfig);
  const [rows, setRows] = useState(initialRows);
  const [summary, setSummary] = useState(initialSummary);
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function request(action: "preview" | "reset") {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/ranking", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, config, confirmation }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Ranking recalculation failed.");
      if (data.config) setConfig(data.config);
      if (data.rows) setRows(data.rows);
      if (data.summary) setSummary(data.summary);
      setMessage(action === "reset" ? `Recalculated ${data.users} players from analyzed map passes.` : "Preview recalculated from stored map passes.");
      if (action === "reset") setConfirmation("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Ranking recalculation failed."); }
    finally { setBusy(false); }
  }

  return <div className="space-y-6">
    <section className="rounded-3xl border border-white/10 bg-surface/95 p-6 shadow-glow">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Ranking system v3</p>
      <h1 className="mt-2 text-2xl font-semibold text-white">Analyzed-map progression</h1>
      <p className="mt-2 max-w-4xl text-sm leading-6 text-muted">Ranks are rebuilt from eligible analyzed-map passes. Rhythia RP, Rhythia global rank, rank-local point locks and top-play weighting do not seed or cap progression. RPL, RPV and RPS receive the full analyzed reward for their camera mode; overall RHP counts multiple modes on the same map with 100%, 55% and 35% same-map weights so broader clears matter without becoming a 3× duplicate payout.</p>
      <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-xs"><thead className="text-muted"><tr><th className="pb-3">Rank</th><th className="pb-3">RHP start</th><th className="pb-3">Map rating</th><th className="pb-3">Next rank</th><th className="pb-3">Tier target</th></tr></thead><tbody>{RANKS.map((rank, index) => { const next = RANKS[index + 1]; const width = next ? next.minRhp - rank.minRhp : null; return <tr key={rank.name} className="border-t border-white/5 text-white"><td className="py-3 font-semibold" style={{ color: rank.color }}>{rank.name}</td><td className="py-3">{rank.minRhp.toLocaleString()}</td><td className="py-3">{rank.rangeMin.toFixed(2)}–{index === RANKS.length - 1 ? `${rank.rangeMin.toFixed(2)}+` : rank.rangeMax.toFixed(2)}</td><td className="py-3">{next ? next.minRhp.toLocaleString() : "—"}</td><td className="py-3">{width ? `~${Math.round(width / 5).toLocaleString()} RHP` : "Expert"}</td></tr>; })}</tbody></table></div>
    </section>

    <section className="rounded-3xl border border-white/10 bg-surface/95 p-6 shadow-glow"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Current recalculation preview</p><h2 className="mt-1 text-xl font-semibold text-white">{summary.users} players</h2><p className="mt-2 text-xs text-muted">Projected RHP range: {summary.min.toLocaleString()}–{summary.max.toLocaleString()}</p></div><button disabled={busy} onClick={() => void request("preview")} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Refresh preview</button></div><div className="mt-4 flex flex-wrap gap-2">{Object.entries(summary.ranks).map(([rank, count]) => <span key={rank} className="rounded-full border border-white/10 bg-black/15 px-3 py-1.5 text-xs text-white">{rank}: {count}</span>)}</div>
      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="text-muted"><tr><th className="pb-3">Player</th><th className="pb-3">Current RHP</th><th className="pb-3">Calculated RHP</th><th className="pb-3">RPL</th><th className="pb-3">RPV</th><th className="pb-3">RPS</th><th className="pb-3">Battle seed</th></tr></thead><tbody>{rows.map(row => <tr key={row.userId} className="border-t border-white/5 text-white"><td className="py-2.5 font-semibold">{row.username}</td><td className="py-2.5">{row.oldRhp.toLocaleString()}</td><td className="py-2.5 font-bold text-accent">{row.newRhp.toLocaleString()}</td><td className="py-2.5">{row.rpl.toLocaleString()}</td><td className="py-2.5">{row.rpv.toLocaleString()}</td><td className="py-2.5">{row.rps.toLocaleString()}</td><td className="py-2.5">{row.battleSeed.toLocaleString()}</td></tr>)}</tbody></table></div>
    </section>

    <section className="rounded-3xl border border-amber-400/20 bg-amber-400/[0.04] p-6"><p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300">Recalculate stored ranks</p><h2 className="mt-2 text-xl font-semibold text-white">Apply analyzed-map totals to every player</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">This removes the effect of the previous placement baseline and sets each user&apos;s RHP to the reproducible total from their stored eligible map passes. It does not fabricate map completions or grant points from Rhythia RP.</p><div className="mt-4 flex flex-col gap-3 sm:flex-row"><input value={confirmation} onChange={event => setConfirmation(event.target.value)} placeholder="Type RECALCULATE RANKS" className="min-w-0 flex-1 rounded-xl border border-amber-400/20 bg-black/20 px-4 py-2.5 text-white outline-none"/><button disabled={busy || confirmation !== "RECALCULATE RANKS"} onClick={() => void request("reset")} className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-black disabled:opacity-40">Recalculate all</button></div>{message && <p className="mt-4 rounded-xl border border-white/10 bg-black/15 p-3 text-sm text-white">{message}</p>}</section>
  </div>;
}
