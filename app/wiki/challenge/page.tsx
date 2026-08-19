import { CATEGORIES, CATEGORY_LABELS, MAX_CATEGORY_LEVEL } from "@/lib/category-constants";
import { MAX_CHALLENGE_LEVEL } from "@/lib/challenge";

const CATEGORY_DESCRIPTIONS = {
  jumps: "Maps focused on jump patterns, spacing, aim transitions, and the ability to move cleanly between demanding note positions.",
  stream: "Maps centered around continuous streams, stamina, rhythm control, alternating movement, and maintaining consistency through sustained patterns.",
  tech: "Maps that emphasize reading, control, unusual rhythms, precision movement, complex pattern interactions, and mechanical adaptability.",
  off_grid: "Maps built around off-grid movement and patterns that challenge conventional reading, requiring stronger spatial awareness and adaptation.",
} as const;

const CHALLENGE_LEVELS = Array.from({ length: MAX_CHALLENGE_LEVEL }, (_, index) => index + 1);

export default function AboutChallengePage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <p className="text-sm uppercase tracking-[0.3em] text-accent">About Challenge</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Challenge is a test of skill</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
          The Challenge system is designed around mechanical and reading skill rather than chasing the
          highest possible accuracy percentage. The goal is to prove that you can actually play the map,
          handle its patterns, and progress through increasingly difficult challenges. Accuracy is still
          recorded, but Challenge is primarily about what you can perform consistently.
        </p>
      </section>

      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <h2 className="text-2xl font-semibold text-white">Challenge categories</h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          The category system separates skill into different pattern families. Each category has its own
          progression, starting at level 0 and advancing through level {MAX_CATEGORY_LEVEL}. You must clear
          the next level in order rather than skipping ahead.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {CATEGORIES.map((category) => (
            <div key={category} className="rounded-2xl border border-border bg-background/70 p-5">
              <p className="text-lg font-semibold text-accent">{CATEGORY_LABELS[category]}</p>
              <p className="mt-2 text-sm leading-6 text-muted">{CATEGORY_DESCRIPTIONS[category]}</p>
              <p className="mt-4 text-xs uppercase tracking-[0.2em] text-muted">Levels 1–{MAX_CATEGORY_LEVEL}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <h2 className="text-2xl font-semibold text-white">The main Challenge map system</h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          The main Challenge ladder is separate from the four category progressions. It contains up to
          {" "}{MAX_CHALLENGE_LEVEL} sequential Challenge levels. Each approved Challenge map is assigned a
          level, and your next level remains locked until you beat the required map at the level immediately
          ahead of your current progress.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CHALLENGE_LEVELS.map((level) => (
            <div key={level} className="rounded-2xl border border-border bg-background/70 p-4">
              <p className="text-sm font-semibold text-white">Level {level}</p>
              <p className="mt-2 text-xs leading-5 text-muted">Main Challenge progression level</p>
            </div>
          ))}
        </div>
        <p className="mt-5 text-sm leading-7 text-muted">
          Main Challenge levels are progression gates, not ranked rating bands. Beating the next Challenge
          level advances you, while a higher level cannot be used to skip the progression. Main Challenge
          clears do not award RHP.
        </p>
      </section>

      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <h2 className="text-2xl font-semibold text-white">Skill first, accuracy second</h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          Challenge is intentionally different from a system where the objective is simply to maximize an
          accuracy number. A clear demonstrates that you can execute the patterns under real gameplay
          conditions. Accuracy remains useful as a performance statistic, but the Challenge progression is
          based on whether you can beat the assigned map and move forward through the ladder.
        </p>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-border bg-background/70 p-5">
            <p className="text-sm font-semibold text-accent">Reading</p>
            <p className="mt-2 text-sm leading-6 text-muted">Recognize patterns and react to difficult or unusual note movement without relying on perfect accuracy.</p>
          </div>
          <div className="rounded-2xl border border-border bg-background/70 p-5">
            <p className="text-sm font-semibold text-accent">Execution</p>
            <p className="mt-2 text-sm leading-6 text-muted">Actually perform the movement, timing, spacing, and pattern requirements of the map consistently.</p>
          </div>
          <div className="rounded-2xl border border-border bg-background/70 p-5">
            <p className="text-sm font-semibold text-accent">Adaptation</p>
            <p className="mt-2 text-sm leading-6 text-muted">Handle maps that demand unfamiliar techniques instead of only farming patterns that are already comfortable.</p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <h2 className="text-2xl font-semibold text-white">Challenge and ranking are separate</h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          Challenge maps are not part of the ranked RHP economy. Passing a Main Challenge or skill-category
          map is used for Challenge progression only and does not award RHP or ranked-map points.
        </p>
      </section>

      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <h2 className="text-2xl font-semibold text-white">RP on Rhythia vs RHP on Rhythians</h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          Rhythia RP and Rhythians RHP serve different purposes. RP is the performance value from Rhythia,
          while RHP is Rhythians&apos; own ranked ladder value. Challenge progression is separate from the ranked
          ladder and does not award RHP.
        </p>
        <div className="mt-5 rounded-2xl border border-border bg-background/70 p-5 text-sm leading-6 text-muted">
          <p><span className="text-white">Rhythia:</span> RP represents your performance in the source game.</p>
          <p className="mt-2"><span className="text-white">Rhythians:</span> RHP represents your position in the Rhythians ranked ladder.</p>
          <p className="mt-2"><span className="text-white">Challenge:</span> progression is about proving that you can beat increasingly difficult maps with pure gameplay skill.</p>
        </div>
      </section>

      <p className="text-center text-xs text-muted">Made by LC727 for Rhythians</p>
    </div>
  );
}
