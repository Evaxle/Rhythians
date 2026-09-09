"use client";

import { useMemo, useState } from "react";
import type { RankingConfig, RankingResetPreviewRow } from "@/lib/ranking-system";

const fields: Array<{ key: keyof RankingConfig; label: string; step: number; min: number; max?: number; detail: string }> = [
  { key: "rpWeight", label: "Linked Rhythia RP weight", step: 0.01, min: 0, max: 1, detail: "How much historical Rhythia RP contributes to initial RHP placement." },
  { key: "expertFloor", label: "Rhythia rank 1–500 floor", step: 100, min: 0, detail: "Minimum starting RHP for proven top-500 Rhythia players." },
  { key: "experiencedFloor", label: "Rhythia rank 501–1000 floor", step: 100, min: 0, detail: "Minimum starting RHP for experienced players." },
  { key: "intermediateFloor", label: "Rhythia rank 1001–5000 floor", step: 100, min: 0, detail: "Minimum starting RHP for intermediate players." },
  { key: "beginnerFloor", label: "Rhythia rank 5001+ floor", step: 100, min: 0, detail: "Minimum starting RHP for lower-ranked linked players." },
  { key: "unrankedRpWeight", label: "Unranked RP weight", step: 0.01, min: 0, max: 1, detail: "Historical RP placement weight when Rhythia global rank is unavailable." },
  { key: "maxPlacementRhp", label: "Placement cap", step: 100, min: 12000, detail: "Maximum RHP granted by historical placement before new Rhythians progression." },
  { key: "modeFallbackFraction", label: "Mode fallback fraction", step: 0.01, min: 0, max: 1, detail: "Conservative fraction of overall placement used to seed unproven RPL/RPS/RPV modes." },
  { key: "strongestModeWeight", label: "Strongest mode weight", step: 0.01, min: 0, max: 1, detail: "Share of ongoing RHP determined by the player's strongest camera mode." },
  { key: "secondModeWeight", label: "Second mode weight", step: 0.01, min: 0, max: 1, detail: "Share of ongoing RHP determined by the second-best mode." },
  { key: "thirdModeWeight", label: "Third mode weight", step: 0.01, min: 0, max: 1, detail: "Share of ongoing RHP determined by the third mode." },
];

type Props = { initialConfig: RankingConfig; initialRows: RankingResetPreviewRow[]; initialSummary: { users: number; ranks: Record<string, number>; min: number; max: number } };

export function RankingSystemControls({ initialConfig, initialRows, initialSummary }: Props) {
  const [config, setConfig] = useState(initialConfig);
  const [rows, setRows] = useState(initialRows);
  const [summary, setSummary] = useState(initialSummary);
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const modeTotal = useMemo(() => config.strongestModeWeight + config.secondModeWeight + config.thirdModeWeight, [config]);

  function update(key: keyof RankingConfig, value: number) { setConfig(current => ({ ...current, [key]: value })); }

  async function request(action: "preview" | "save" | "reset") {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/ranking", { method: action === "save" ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action === "save" ? { config } : { action, config, confirmation }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Ranking update failed.");
      if (data.config) setConfig(data.config);
      if (data.rows) setRows(data.rows);
      if (data.summary) setSummary(data.summary);
      setMessage(action === "reset" ? `Reset complete for ${data.users} users. Reset ID: ${data.resetId}` : action === "save" ? "Ranking controls saved." : "Preview recalculated.");
      if (action === "reset") setConfirmation("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Ranking update failed."); }
    finally { setBusy(false); }
  }

  return <div className="space-y-6">
    <section className="rounded-3xl border border-white/10 bg-surface/95 p-6 shadow-glow">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Ranking system v2</p><h1 className="mt-2 text-2xl font-semibold text-white">Placement and progression controls</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">RHP is a weighted competitive rating. RPL, RPS and RPV are independent camera-mode ratings. Historical Rhythia rank and RP only seed the starting floor; ranked map results drive progression after placement.</p></div><div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-right"><p className="text-xs text-muted">Mode weight total</p><p className={`mt-1 text-lg font-bold ${Math.abs(modeTotal - 1) < 0.001 ? "text-emerald-300" : "text-amber-300"}`}>{modeTotal.toFixed(2)}</p></div></div>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{fields.map(field => <label key={field.key} className="rounded-2xl border border-white/10 bg-black/15 p-4"><span className="text-sm font-semibold text-white">{field.label}</span><input type="number" value={Number(config[field.key])} step={field.step} min={field.min} max={field.max} onChange={event => update(field.key, Number(event.target.value))} className="mt-3 w-full rounded-xl border border-white/10 bg-[#101629] px-3 py-2 text-white outline-none focus:border-accent/50"/><span className="mt-2 block text-[11px] leading-5 text-muted">{field.detail}</span></label>)}</div>
      <div className="mt-5 flex flex-wrap gap-2"><button disabled={busy} onClick={() => void request("preview")} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Preview reset</button><button disabled={busy} onClick={() => void request("save")} className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save controls</button></div>
    </section>

    <section className="rounded-3xl border border-white/10 bg-surface/95 p-6 shadow-glow"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Reset preview</p><h2 className="mt-1 text-xl font-semibold text-white">{summary.users} players</h2></div><div className="flex flex-wrap gap-2">{Object.entries(summary.ranks).map(([rank, count]) => <span key={rank} className="rounded-full border border-white/10 bg-black/15 px-3 py-1.5 text-xs text-white">{rank}: {count}</span>)}</div></div><p className="mt-3 text-xs text-muted">Projected RHP range: {summary.min.toLocaleString()}–{summary.max.toLocaleString()}</p>
      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="text-muted"><tr><th className="pb-3">Player</th><th className="pb-3">Rhythia</th><th className="pb-3">Old RHP</th><th className="pb-3">New RHP</th><th className="pb-3">RPL</th><th className="pb-3">RPS</th><th className="pb-3">RPV</th><th className="pb-3">Battle seed</th></tr></thead><tbody>{rows.map(row => <tr key={row.userId} className="border-t border-white/5 text-white"><td className="py-2.5 font-semibold">{row.username}</td><td className="py-2.5 text-muted">{row.globalRank ? `#${row.globalRank}` : "—"} · {Math.round(row.rhythmPoints).toLocaleString()} RP</td><td className="py-2.5">{row.oldRhp.toLocaleString()}</td><td className="py-2.5 font-bold text-accent">{row.newRhp.toLocaleString()}</td><td className="py-2.5">{row.rpl.toLocaleString()}</td><td className="py-2.5">{row.rps.toLocaleString()}</td><td className="py-2.5">{row.rpv.toLocaleString()}</td><td className="py-2.5">{row.battleSeed.toLocaleString()}</td></tr>)}</tbody></table></div>
    </section>

    <section className="rounded-3xl border border-rose-400/20 bg-rose-400/[0.04] p-6"><p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-300">Full reset</p><h2 className="mt-2 text-xl font-semibold text-white">Re-place every player</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">This clears legacy RHP/RPL/RPS/RPV overrides, creates fresh placement baselines, recalculates all four ratings, reseeds the active battle season, and records every before/after value in the ranking reset audit table.</p><div className="mt-4 flex flex-col gap-3 sm:flex-row"><input value={confirmation} onChange={event => setConfirmation(event.target.value)} placeholder="Type RESET RANKS" className="min-w-0 flex-1 rounded-xl border border-rose-400/20 bg-black/20 px-4 py-2.5 text-white outline-none"/><button disabled={busy || confirmation !== "RESET RANKS"} onClick={() => void request("reset")} className="rounded-xl bg-rose-500 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40">Apply full reset</button></div>{message && <p className="mt-4 rounded-xl border border-white/10 bg-black/15 p-3 text-sm text-white">{message}</p>}</section>
  </div>;
}
