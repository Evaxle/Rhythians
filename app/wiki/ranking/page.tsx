import { RANKS, RANK_TIERS, TIER_SPAN, getRankInfo } from "@/lib/ranks";
import { RankIcon } from "@/components/rank-icon";

const ACCURACY_TIERS = [
  { min: 100, label: "100% of weighted RHP", note: "Perfect clear" },
  { min: 99, label: "90% of weighted RHP", note: "Near-perfect clear" },
  { min: 98, label: "75% of weighted RHP", note: "Great clear" },
  { min: 95, label: "60% of weighted RHP", note: "Solid clear" },
  { min: 90, label: "50% of weighted RHP", note: "Passed, okay" },
  { min: 0, label: "40% of weighted RHP", note: "Passed, rough" },
];

export default function AboutRankingPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <p className="text-sm uppercase tracking-[0.3em] text-accent">About Ranking</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">The Rhythians ranked ladder</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
          Rhythians uses Rhythian Points (RHP) as its competitive ranking value. Your RHP determines
          your rank and tier, while the maps you play, their rating, map length, accuracy, and speed
          modifier determine how much RHP a successful ranked play is worth.
        </p>
      </section>

      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <h2 className="text-2xl font-semibold text-white">The ranks</h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          Each rank spans 500 RHP and contains 5 tiers of 100 RHP each. Expert begins at 4000 RHP and
          is the top rank; Expert does not use the normal tier display and instead shows your global
          leaderboard position. Map rating ranges determine which maps are eligible to award RHP.
        </p>

        <div className="mt-6 overflow-hidden rounded-2xl border border-border">
          <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
            {RANKS.map((rank) => {
              const tierIcons = rank.index < RANKS.length - 1 ? [1, 2, 3, 4, 5].map((tier) => <RankIcon key={tier} rank={getRankInfo(rank.minRhp + (tier - 1) * TIER_SPAN)} size={42} />) : [<RankIcon key="expert" rank={getRankInfo(rank.minRhp)} size={58} />];
              return (
                <div key={rank.name} className="bg-surface p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">{tierIcons}</div>
                  </div>
                  <p className="mt-3 text-sm font-semibold" style={{ color: rank.color }}>{rank.name}</p>
                  <p className="mt-2 text-xs text-muted">
                    {rank.minRhp.toLocaleString()}{rank.index === RANKS.length - 1 ? "+" : ` – ${(rank.minRhp + 500).toLocaleString()}`} RHP
                  </p>
                  <p className="mt-1 text-xs text-muted">Map rating {rank.rangeMin.toFixed(2)} – {rank.rangeMax.toFixed(2)}</p>
                  <p className="mt-2 text-[11px] text-muted">
                    {rank.index === RANKS.length - 1 ? "Global rank position" : `${RANK_TIERS} tiers × ${TIER_SPAN} RHP each`}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-background/70 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Example tiers</p>
          <div className="mt-4 space-y-3 text-sm text-muted">
            {[0, 1, 2, 3, 4].map((tier) => {
              const rank = getRankInfo(tier * TIER_SPAN);
              return <div key={tier} className="flex items-center gap-3"><RankIcon rank={rank} size={34} /><span>{rank.name} {rank.tier} = {rank.tierStart.toLocaleString()} – {(rank.tierEnd - 1).toLocaleString()} RHP</span></div>;
            })}
            <div className="flex items-center gap-3"><RankIcon rank={getRankInfo(4000)} size={44} /><span>Expert = 4000+ RHP and displays global leaderboard position</span></div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <h2 className="text-2xl font-semibold text-white">RHP and eligible map ratings</h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          RHP is earned from ranked plays on maps inside your current rank&apos;s rating band. The current
          bands run from 0.00 through 9.99 and become progressively harder as your rank increases.
          Playing a map outside your current band does not award ranked RHP.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {RANKS.map((rank) => (
            <div key={rank.name} className="rounded-2xl border border-border bg-background/70 p-4">
              <div className="flex items-center gap-3"><RankIcon rank={getRankInfo(rank.minRhp)} size={36} /><p className="text-sm font-semibold" style={{ color: rank.color }}>{rank.name}</p></div>
              <p className="mt-2 text-sm text-muted">{rank.rangeMin.toFixed(2)} – {rank.rangeMax.toFixed(2)} rating</p>
            </div>
          ))}
        </div>
        <p className="mt-5 text-sm leading-7 text-muted">
          Map ratings use the Rhythia star rating conversion of <span className="text-white">stars × 0.41</span>,
          rounded to two decimals. A typical 5-star Rhythia map therefore converts to about 2.05 Rhythians rating.
          The approved map rating is the value used for ranked eligibility and RHP weighting.
        </p>
      </section>

      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <h2 className="text-2xl font-semibold text-white">The new RHP weighting system</h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          RHP is no longer a simple fixed reward for every clear. The reward is weighted by the map&apos;s
          position inside your rank&apos;s rating range, its length, your accuracy, and your speed modifier.
          This makes stronger and longer plays more meaningful while still rewarding consistency.
        </p>

        <div className="mt-5 rounded-2xl border border-border bg-background/70 p-5 text-sm leading-6 text-muted">
          <p><span className="text-white">Base map value:</span> 18–25 RHP depending on where the map&apos;s rating falls inside the current rank&apos;s rating range.</p>
          <p className="mt-2"><span className="text-white">Length weighting:</span> map length changes the base value, with a reference length of 180 seconds and a capped multiplier from 0.70× to 1.35×.</p>
          <p className="mt-2"><span className="text-white">Accuracy weighting:</span> the base after rating and length weighting is multiplied by the accuracy tier below.</p>
          <p className="mt-2"><span className="text-white">Speed weighting:</span> speed modifiers above 1.00× add 25% for each additional 1.00×, capped at a 1.50× multiplier.</p>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-border">
          {ACCURACY_TIERS.map((tier, index) => (
            <div key={index} className={`grid grid-cols-2 gap-3 border-b border-border px-4 py-3 last:border-0 ${index % 2 ? "bg-background/60" : "bg-background/40"}`}>
              <div>
                <p className="text-sm font-semibold text-white">{tier.min}%+ accuracy</p>
                <p className="text-xs text-muted">{tier.note}</p>
              </div>
              <p className="text-right text-sm font-semibold text-accent">{tier.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-border bg-background/70 p-5 text-sm leading-6 text-muted">
          <p>
            For example, a map worth 20 RHP before performance weighting gives 20 RHP at 100% accuracy,
            18 at 99%, 15 at 98%, 12 at 95%, 10 at 90%, and 8 below 90%. A 2.00× speed modifier applies
            a 1.25× multiplier, so the 100% clear becomes 25 RHP before any length weighting is applied.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <h2 className="text-2xl font-semibold text-white">Why the weighting matters</h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          The ladder is intended to measure actual performance rather than reward grinding the easiest
          eligible maps. Rating determines the difficulty value, length accounts for the amount of gameplay
          completed, accuracy measures consistency, and speed modifiers reward voluntarily increasing the
          mechanical demand. Because all of these factors are combined, a strong clear on a difficult map
          can be substantially more valuable than a weak clear on an easier one.
        </p>
      </section>

      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <h2 className="text-2xl font-semibold text-white">Daily maps</h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          Daily maps are selected separately for each rank from that rank&apos;s rating range. The daily
          reward uses the same current RHP weighting principles, so accuracy, speed, map rating, and map
          length all matter. Consecutive daily clears also build the daily streak leaderboard.
        </p>
      </section>

      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <h2 className="text-2xl font-semibold text-white">RHP and Rhythia RP</h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          Rhythia RP and Rhythians RHP are separate values. Rhythia RP is the source game&apos;s performance
          ranking, while RHP is the competitive ranking value used by Rhythians. Rhythians does not simply
          convert Rhythia RP into RHP; ranked RHP is earned through Rhythians&apos; own map eligibility and
          performance weighting system.
        </p>
      </section>

      <p className="text-center text-xs text-muted">Made by LC727 for Rhythians</p>
    </div>
  );
}
