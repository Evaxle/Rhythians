import Link from "next/link";
import { Settings2, Grid3X3, Trophy, ArrowRight } from "lucide-react";

export default function WikiPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <p className="text-sm uppercase tracking-[0.3em] text-accent">Wiki</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Rhythia settings, patterns & ranking</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
          Learn how the main game settings affect your gameplay and aim, explore the pattern
          library used across the community, and understand the Rhythians ranked ladder — every
          rank, tier, RHP value, and map rating.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Link
          href="/wiki/ranking"
          className="group rounded-3xl border border-border bg-surface/95 p-6 shadow-glow transition hover:border-accent/40 hover:bg-surface/90"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <Trophy size={24} />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-white group-hover:text-accent">About Ranking</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Every rank and tier, how Rhythian Points are earned and lost, how map ratings work, and
            how accuracy weights your RHP.
          </p>
          <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-accent transition group-hover:text-white">
            Read the ranking guide <ArrowRight size={16} />
          </span>
        </Link>

        <Link
          href="/wiki/settings"
          className="group rounded-3xl border border-border bg-surface/95 p-6 shadow-glow transition hover:border-accent/40 hover:bg-surface/90"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <Settings2 size={24} />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-white group-hover:text-accent">Settings Guide</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Approach rate, spawn distance, sensitivity & DPI, parallax, spin mode, note meshes, half
            ghost, note pushback, and the other settings that make the biggest difference.
          </p>
          <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-accent transition group-hover:text-white">
            Open the guide <ArrowRight size={16} />
          </span>
        </Link>

        <Link
          href="/wiki/patterns"
          className="group rounded-3xl border border-border bg-surface/95 p-6 shadow-glow transition hover:border-accent/40 hover:bg-surface/90"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <Grid3X3 size={24} />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-white group-hover:text-accent">Patterns Wiki</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Every core pattern on a 3×3 grid — streams, jumps, slides, stacks, spirals, anchors,
            off-grid paths, and bursts — with how it reads and every way it can be mapped.
          </p>
          <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-accent transition group-hover:text-white">
            Browse patterns <ArrowRight size={16} />
          </span>
        </Link>
      </div>
    </div>
  );
}
