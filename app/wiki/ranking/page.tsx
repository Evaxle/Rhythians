import { RANKS, RANK_TIERS, TIER_SPAN } from "@/lib/ranks";

const ACCURACY_TIERS = [
  { min: 100, label: "100% of base RHP", note: "Perfect clear" },
  { min: 99, label: "90% of base RHP", note: "Near-perfect clear" },
  { min: 98, label: "75% of base RHP", note: "Great clear" },
  { min: 95, label: "60% of base RHP", note: "Solid clear" },
  { min: 90, label: "50% of base RHP", note: "Passed, okay" },
  { min: 0, label: "40% of base RHP", note: "Passed, rough" },
];

export default function AboutRankingPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <p className="text-sm uppercase tracking-[0.3em] text-accent">About Ranking</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">The Rhythians ranked ladder</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
          Rhythians uses a competitive ladder built around Rhythian Points (RHP). There are 9 ranks,
          each split into 5 tiers. You climb by beating maps and daily maps — but you can also lose
          RHP by failing challenge maps, so the ladder stays fair and everyone plays maps near their
          own skill level.
        </p>
      </section>

      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <h2 className="text-2xl font-semibold text-white">The ranks</h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          Each rank spans 500 RHP and holds 5 tiers of 100 RHP each. Your rank is based purely on your
          current RHP. Every rank also has a <span className="text-white">map rating range</span> it is
          allowed to play for points.
        </p>

        <div className="mt-6 overflow-hidden rounded-2xl border border-border">
          <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-4">
            {RANKS.map((rank) => (
              <div key={rank.name} className="bg-surface p-4">
                <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: rank.color }}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: rank.color }} />
                  {rank.name}
                </p>
                <p className="mt-2 text-xs text-muted">
                  {rank.minRhp.toLocaleString()}
                  {rank.index === RANKS.length - 1 ? "+" : ` – ${(rank.minRhp + 500).toLocaleString()}`} RHP
                </p>
                <p className="mt-1 text-xs text-muted">
                  Map rating {rank.rangeMin.toFixed(2)} – {rank.rangeMax.toFixed(2)}
                </p>
                <p className="mt-2 text-[11px] text-muted">
                  {rank.index === RANKS.length - 1
                    ? "No tiers — shows your global # on the badge."
                    : `${RANK_TIERS} tiers × ${TIER_SPAN} RHP each`}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-background/70 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Example tiers</p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-muted">
            <li>Copper 1 = 0 – 100 RHP</li>
            <li>Copper 2 = 101 – 200 RHP</li>
            <li>Copper 5 = 401 – 500 RHP</li>
            <li>Bronze 1 = 501 – 600 RHP (just crossed into Bronze)</li>
            <li>Master 5 = 3501 – 4000 RHP</li>
            <li>The Expert rank shows your global position (#1, #2…) on the badge.</li>
          </ul>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <h2 className="text-2xl font-semibold text-white">Rhythian Points (RHP)</h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          RHP is the currency of the ladder. Everyone starts at 0 (Copper 1) and climbs by earning RHP.
        </p>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5">
            <p className="text-sm font-semibold text-emerald-300">How you gain RHP</p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-muted">
              <li>
                <span className="text-white">Daily maps:</span> beating the daily map awards base RHP based on your
                rank, scaled by accuracy and speed. A Copper daily and a Master daily both reward their own rank&apos;s
                base.
              </li>
              <li>
                <span className="text-white">Challenge maps:</span> beating any map inside your rank&apos;s rating range
                awards base RHP based on your rank (higher ranks award slightly less, keeping the ladder balanced),
                scaled by your accuracy and speed.
              </li>
            </ul>
          </div>
          <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-5">
            <p className="text-sm font-semibold text-red-300">How you lose RHP</p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-muted">
              <li>
                <span className="text-white">Failing a challenge map</span> costs RHP based on how many players have
                beaten the map and the placement your failed attempt would earn. The better your attempt, the less
                you lose — an attempt with no recorded accuracy is treated as last place.
              </li>
              <li>RHP never drops below 0, and a failed map only counts once per map.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <h2 className="text-2xl font-semibold text-white">How map ratings work</h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          Every map has a rating with two decimal places (e.g. 2.05). The rating decides which ranks may
          play the map for points. The site converts Rhythia&apos;s star rating into this scale:
        </p>
        <div className="mt-4 rounded-2xl border border-border bg-background/70 p-5 text-sm text-white">
          Rhythia rating = stars × 0.41 <span className="text-muted">(rounded to 2 decimals)</span> — a typical 5-star Rhythia map is ≈ 2.05
        </div>
        <p className="mt-4 text-sm leading-7 text-muted">
          Each rank may only earn RHP from maps inside its rating band. A Copper cannot gain from a Diamond
          map, and a Diamond cannot gain from a Bronze map. Playing a map outside your range earns nothing.
        </p>
        <p className="mt-3 text-sm leading-7 text-muted">
          <span className="text-white">Who sets the rating?</span> Submitters suggest a rating when they
          submit a map. The map-reviewer confirms (or overrides) the final rating on approval — the
          reviewer&apos;s rating is what actually counts.
        </p>
      </section>

      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <h2 className="text-2xl font-semibold text-white">RHP weighting by accuracy & speed</h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          Beating any challenge map inside your rank&apos;s rating range awards base RHP that depends on your rank —
          higher ranks earn slightly less so climbing stays balanced. At 100% accuracy with no modifiers:
        </p>
        <div className="mt-5 overflow-hidden rounded-2xl border border-border">
          <div className="grid grid-cols-2 gap-3 border-b border-border bg-background/40 px-4 py-3 sm:grid-cols-3">
            {RANKS.map((rank) => (
              <div key={rank.name}>
                <p className="text-sm font-semibold" style={{ color: rank.color }}>{rank.name}</p>
                <p className="text-xs text-muted">{Math.max(10, 20 - rank.index)} RHP</p>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-4 text-sm leading-7 text-muted">
          <span className="text-white">Copper</span> is worth 20 RHP, dropping by 2 RHP per rank down to{" "}
          <span className="text-white">Master at 13 RHP</span>, with <span className="text-white">Expert at 10 RHP</span>.
          Your accuracy and any speed modifier scale the base:
        </p>
        <div className="mt-4 overflow-hidden rounded-2xl border border-border">
          {ACCURACY_TIERS.map((tier, index) => (
            <div key={index} className={`grid grid-cols-2 gap-3 border-b border-border px-4 py-3 last:border-0 ${index % 2 ? "bg-background/60" : "bg-background/40"}`}>
              <div>
                <p className="text-sm font-semibold text-white">{tier.min}%+ accuracy</p>
                <p className="text-xs text-muted">{tier.note}</p>
              </div>
              <p className="text-right text-sm font-semibold" style={{ color: tier.min >= 100 ? "#4ade80" : tier.min >= 98 ? "#facc15" : "#f87171" }}>
                {tier.label}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-2xl border border-border bg-background/70 p-5 text-sm leading-6 text-muted">
          <p>
            <span className="text-white">Speed modifier bonus:</span> playing with a speed modifier (anything above
            1.00x) adds <span className="text-white">25% per 1.00x of extra speed</span>, capped at +50%. A 2.00x
            perfect clear in Copper earns 20 × 1.25 = 25 RHP.
          </p>
        </div>
        <div className="mt-5 rounded-2xl border border-border bg-background/70 p-5 text-sm leading-6 text-muted">
          Example: beating any map in your rank&apos;s range — Copper base = 20 RHP. At 100% accuracy you earn 20, at
          99% you earn 18, at 98% you earn 15, at 95% you earn 12, and below 90% you earn 8. Adding a 2.00x speed
          modifier bumps a perfect clear to 25. In Master the same play is worth 13 RHP (13 × 1.25 = 16 with the
          speed mod).
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <h2 className="text-2xl font-semibold text-white">Daily maps & streaks</h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          Every day at midnight UTC a new daily map is picked <span className="text-white">for each rank</span>,
          chosen at random from maps inside that rank&apos;s rating range so it always matches your skill level.
          Each rank sees its own daily map, and maps aren&apos;t repeated within a calendar month.
        </p>
        <p className="mt-3 text-sm leading-7 text-muted">
          Beating the daily map on consecutive days builds a <span className="text-white">streak</span>, and rewards
          the same rank-based RHP as challenge maps (your rank&apos;s base at 100% accuracy), scaled by your accuracy
          and speed. If you miss a day, your streak resets to 0. The daily leaderboard ranks players by their streak,
          within their own rank only.
        </p>
      </section>

      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <h2 className="text-2xl font-semibold text-white">The leaderboards</h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          There are two kinds of leaderboard, each split per-rank (a separate board for Copper, Bronze, Silver, etc.):
        </p>
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-border bg-background/70 p-5">
            <p className="text-sm font-semibold text-accent">Daily leaderboards</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              Ranked by daily map <span className="text-white">streak</span> within your rank. A Bronze player
              with a 50-day streak ranks above a Master with 30 — on the Bronze board. Cross-rank comparison
              doesn&apos;t matter; each board is only about the players in that rank.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-background/70 p-5">
            <p className="text-sm font-semibold text-accent">Challenge leaderboards</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              Ranked by <span className="text-white">RHP</span> within your rank. Everyone starts at the bottom
              of their rank&apos;s board and climbs by earning RHP.
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm leading-7 text-muted">
          Only <span className="text-white">Rhythia-verified</span> members appear on (or contribute to) the
          leaderboards — unverified accounts are never listed. Because the ladder goes both up and down, players who
          stop progressing settle into the lower ranks instead of hoarding points.
        </p>
      </section>

      <p className="text-center text-xs text-muted">Made by LC727 for Rhythians</p>
    </div>
  );
}