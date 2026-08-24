"use client";

import { useMemo, useState } from "react";
import { Calculator, Star } from "lucide-react";
import { fairRatingFromStars } from "@/lib/ranks";

function number(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function RatingConversionCalculators() {
  const [stars, setStars] = useState("5");
  const [rating, setRating] = useState("2.05");

  const ratingFromStars = useMemo(() => fairRatingFromStars(number(stars)), [stars]);
  const starsFromRating = useMemo(() => Math.max(0, number(rating) / 0.41), [rating]);

  return (
    <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/15 text-accent">
          <Calculator size={20} />
        </div>
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-accent">Rating tools</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">Star ↔ rating calculator</h2>
        </div>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <div className="rounded-3xl border border-border bg-background/50 p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-accent">
            <Star size={14} fill="currentColor" /> Rhythia stars → map rating
          </div>
          <label className="mt-4 block text-sm text-muted">
            Rhythia star rating
            <input
              value={stars}
              onChange={(event) => setStars(event.target.value)}
              type="number"
              step="0.01"
              min="0"
              className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-white outline-none focus:border-accent"
            />
          </label>
          <p className="mt-4 text-3xl font-semibold text-white">{ratingFromStars.toFixed(2)}</p>
          <p className="mt-1 text-xs text-muted">Calculated Rhythian map rating</p>
        </div>

        <div className="rounded-3xl border border-border bg-background/50 p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-accent">
            <Star size={14} fill="currentColor" /> Map rating → Rhythia stars
          </div>
          <label className="mt-4 block text-sm text-muted">
            Rhythian map rating
            <input
              value={rating}
              onChange={(event) => setRating(event.target.value)}
              type="number"
              step="0.01"
              min="0"
              max="9.99"
              className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-white outline-none focus:border-accent"
            />
          </label>
          <p className="mt-4 text-3xl font-semibold text-white">{starsFromRating.toFixed(2)}</p>
          <p className="mt-1 text-xs text-muted">Equivalent Rhythia star rating</p>
        </div>
      </div>
    </section>
  );
}
