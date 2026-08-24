"use client";

import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { RANKS, baseRhpForRating, fairRatingFromStars, getRankInfo, rhpGainForMap, rankIndexForRating, rankLabel } from "@/lib/ranks";

function number(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function RatingCalculators() {
  const [stars, setStars] = useState("5");
  const [rating, setRating] = useState("2.05");
  const [rhp, setRhp] = useState("1250");
  const [accuracy, setAccuracy] = useState("100");
  const [speed, setSpeed] = useState("1");
  const [length, setLength] = useState("180");

  const ratingFromStars = useMemo(() => fairRatingFromStars(number(stars)), [stars]);
  const starsFromRating = useMemo(() => Math.max(0, number(rating) / 0.41), [rating]);
  const mapRating = number(rating);
  const ratingRank = useMemo(() => getRankInfo(number(rhp)), [rhp]);
  const mapRankIndex = rankIndexForRating(mapRating);
  const base = baseRhpForRating(mapRating, mapRankIndex);
  const weighted = rhpGainForMap(mapRating, number(accuracy, 100), number(speed, 1), mapRankIndex, number(length, 0) || null);

  return (
    <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
      <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/15 text-accent"><Calculator size={20} /></div><div><p className="text-sm uppercase tracking-[0.3em] text-accent">Calculation tools</p><h2 className="mt-1 text-2xl font-semibold text-white">Rating and RHP calculators</h2></div></div>

      <div className="mt-6 grid gap-6 lg:grid-cols-4">
        <div className="rounded-3xl border border-border bg-background/50 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-accent">Rhythia stars → map rating</p>
          <label className="mt-4 block text-sm text-muted">Rhythia star rating<input value={stars} onChange={(e) => setStars(e.target.value)} type="number" step="0.01" min="0" className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-white outline-none focus:border-accent" /></label>
          <p className="mt-4 text-3xl font-semibold text-white">{ratingFromStars.toFixed(2)}</p>
          <p className="mt-1 text-xs text-muted">Calculated Rhythian map rating</p>
        </div>

        <div className="rounded-3xl border border-border bg-background/50 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-accent">Map rating → Rhythia stars</p>
          <label className="mt-4 block text-sm text-muted">Map rating<input value={rating} onChange={(e) => setRating(e.target.value)} type="number" step="0.01" min="0" max="9.99" className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-white outline-none focus:border-accent" /></label>
          <p className="mt-4 text-3xl font-semibold text-white">{starsFromRating.toFixed(2)}★</p>
          <p className="mt-1 text-xs text-muted">Equivalent Rhythia star rating</p>
        </div>

        <div className="rounded-3xl border border-border bg-background/50 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-accent">Map rating → RHP</p>
          <label className="mt-4 block text-sm text-muted">Map rating<input value={rating} onChange={(e) => setRating(e.target.value)} type="number" step="0.01" min="0" max="9.99" className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-white outline-none focus:border-accent" /></label>
          <div className="mt-4 flex items-end justify-between gap-4"><div><p className="text-3xl font-semibold text-white">{base.toFixed(1)}</p><p className="text-xs text-muted">100% base RHP</p></div><p className="text-right text-sm font-semibold text-accent">{RANKS[mapRankIndex].name}<br />{RANKS[mapRankIndex].rangeMin.toFixed(2)}–{RANKS[mapRankIndex].rangeMax.toFixed(2)}</p></div>
        </div>

        <div className="rounded-3xl border border-border bg-background/50 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-accent">RHP → rank</p>
          <label className="mt-4 block text-sm text-muted">RHP<input value={rhp} onChange={(e) => setRhp(e.target.value)} type="number" step="1" min="0" className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-white outline-none focus:border-accent" /></label>
          <p className="mt-4 text-3xl font-semibold text-white">{rankLabel(ratingRank)}</p>
          <p className="mt-1 text-xs text-muted">Tier {ratingRank.tier} · map range {ratingRank.rangeMin.toFixed(2)}–{ratingRank.rangeMax.toFixed(2)}</p>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-border bg-background/50 p-5">
        <p className="text-xs uppercase tracking-[0.24em] text-accent">Weighted RHP gain</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm text-muted">Accuracy %<input value={accuracy} onChange={(e) => setAccuracy(e.target.value)} type="number" step="0.01" min="0" max="100" className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-white outline-none focus:border-accent" /></label>
          <label className="text-sm text-muted">Speed multiplier<input value={speed} onChange={(e) => setSpeed(e.target.value)} type="number" step="0.01" min="1" className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-white outline-none focus:border-accent" /></label>
          <label className="text-sm text-muted">Length seconds<input value={length} onChange={(e) => setLength(e.target.value)} type="number" step="1" min="0" className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-white outline-none focus:border-accent" /></label>
          <div><p className="text-sm text-muted">RHP gained</p><p className="mt-2 text-3xl font-semibold text-accent">{weighted}</p></div>
        </div>
        <p className="mt-4 text-xs leading-5 text-muted">Each rank interpolates from 18 RHP at its floor rating to 25 RHP at its highest rating. Accuracy, speed, and map length then apply the normal weighting multipliers.</p>
      </div>
    </section>
  );
}
