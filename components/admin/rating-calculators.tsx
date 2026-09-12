"use client";

import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { RANKS, baseRhpForRating, getRankInfo, rankIndexForRating, rankLabel } from "@/lib/ranks";

function number(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function RatingCalculators() {
  const [rating, setRating] = useState("5.00");
  const [rhp, setRhp] = useState("5150");
  const mapRating = Math.max(0, number(rating));
  const ratingRank = useMemo(() => getRankInfo(number(rhp)), [rhp]);
  const mapRankIndex = rankIndexForRating(mapRating);
  const base = baseRhpForRating(mapRating);
  const lock = Math.max(1, Math.round(base));
  const vr = Math.max(lock, Math.round(lock * 1.06));
  const spin = Math.max(lock, Math.round(lock * 1.12));

  return (
    <section className="ui-panel ui-panel-compact">
      <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/15 text-accent"><Calculator size={20} /></div><div><p className="ui-eyebrow">Calculation tools</p><h2 className="mt-1 text-2xl font-semibold text-white">Analyzed rating and rank reference</h2></div></div>
      <p className="mt-3 max-w-4xl text-sm leading-6 text-muted">Rhythia stars are not converted into Rhythians ratings. The map analyzer determines rating from raw note direction, distance, relative NPS, sustained strain and speed-sensitive pattern difficulty. This reference shows the base point curve after a rating has been analyzed.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-border bg-background/50 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-accent">Analyzed rating</p>
          <label className="mt-4 block text-sm text-muted">Map rating<input value={rating} onChange={(e) => setRating(e.target.value)} type="number" step="0.01" min="0" className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-white outline-none focus:border-accent" /></label>
          <div className="mt-4 flex items-end justify-between gap-4"><div><p className="text-3xl font-semibold text-white">{mapRating.toFixed(2)}</p><p className="text-xs text-muted">Analyzer result</p></div><p className="text-right text-sm font-semibold text-accent">{RANKS[mapRankIndex].name}<br />{RANKS[mapRankIndex].rangeMin.toFixed(2)}–{mapRankIndex === RANKS.length - 1 ? `${RANKS[mapRankIndex].rangeMin.toFixed(2)}+` : RANKS[mapRankIndex].rangeMax.toFixed(2)}</p></div>
        </div>

        <div className="rounded-3xl border border-border bg-background/50 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-accent">Base map rewards</p>
          <div className="mt-4 grid grid-cols-3 gap-3"><div><p className="text-xs text-muted">RPL</p><p className="mt-1 text-2xl font-semibold text-white">{lock}</p></div><div><p className="text-xs text-muted">RPV</p><p className="mt-1 text-2xl font-semibold text-white">{vr}</p></div><div><p className="text-xs text-muted">RPS</p><p className="mt-1 text-2xl font-semibold text-white">{spin}</p></div></div>
          <p className="mt-4 text-xs leading-5 text-muted">The live analyzer can raise these values for sustained stamina. RPV is 6% above Lock and RPS is 12% above Lock. Speed-modified passes use the map&apos;s stored speed profile rather than this simple base reference.</p>
        </div>

        <div className="rounded-3xl border border-border bg-background/50 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-accent">RHP → rank</p>
          <label className="mt-4 block text-sm text-muted">RHP<input value={rhp} onChange={(e) => setRhp(e.target.value)} type="number" step="1" min="0" className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-white outline-none focus:border-accent" /></label>
          <p className="mt-4 text-3xl font-semibold text-white">{rankLabel(ratingRank)}</p>
          <p className="mt-1 text-xs text-muted">Tier {ratingRank.tier} · map range {ratingRank.rangeMin.toFixed(2)}–{ratingRank.isExpert ? `${ratingRank.rangeMin.toFixed(2)}+` : ratingRank.rangeMax.toFixed(2)}</p>
        </div>
      </div>
    </section>
  );
}
