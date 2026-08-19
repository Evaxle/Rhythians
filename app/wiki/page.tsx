import Link from "next/link";
import { Settings2, Grid3X3, Trophy, Swords, ArrowRight } from "lucide-react";

export default function WikiPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <p className="text-sm uppercase tracking-[0.3em] text-accent">Wiki</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Rhythia settings, patterns, ranking & challenges</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
          Learn how the main game settings affect gameplay, explore the pattern library, understand
          the current Rhythians ranked ladder and RHP weighting system, and learn how the category
          and main Challenge systems test pure skill.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Link href="/wiki/ranking" className="group rounded-3xl border border-border bg-surface/95 p-6 shadow-glow transition hover:border-accent/40 hover:bg-surface/90">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent"><Trophy size={24} /></div>
          <h2 className="mt-4 text-xl font-semibold text-white group-hover:text-accent">About Ranking</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Ranks, tiers, map rating ranges, RHP, and the current rating, length, accuracy, and speed weighting system.</p>
          <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-accent transition group-hover:text-white">Read the ranking guide <ArrowRight size={16} /></span>
        </Link>

        <Link href="/wiki/challenge" className="group rounded-3xl border border-border bg-surface/95 p-6 shadow-glow transition hover:border-accent/40 hover:bg-surface/90">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent"><Swords size={24} /></div>
          <h2 className="mt-4 text-xl font-semibold text-white group-hover:text-accent">About Challenge</h2>
          <p className="mt-2 text-sm leading-6 text-muted">The Jumps, Stream, Tech, and Off Grid categories, the level-based Challenge map system, and why Challenge is built around pure skill.</p>
          <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-accent transition group-hover:text-white">Read the challenge guide <ArrowRight size={16} /></span>
        </Link>

        <Link href="/wiki/settings" className="group rounded-3xl border border-border bg-surface/95 p-6 shadow-glow transition hover:border-accent/40 hover:bg-surface/90">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent"><Settings2 size={24} /></div>
          <h2 className="mt-4 text-xl font-semibold text-white group-hover:text-accent">Settings Guide</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Approach rate, spawn distance, sensitivity & DPI, parallax, spin mode, note meshes, half ghost, note pushback, and other important settings.</p>
          <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-accent transition group-hover:text-white">Open the guide <ArrowRight size={16} /></span>
        </Link>

        <Link href="/wiki/patterns" className="group rounded-3xl border border-border bg-surface/95 p-6 shadow-glow transition hover:border-accent/40 hover:bg-surface/90">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent"><Grid3X3 size={24} /></div>
          <h2 className="mt-4 text-xl font-semibold text-white group-hover:text-accent">Patterns Wiki</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Core patterns on a 3×3 grid — streams, jumps, slides, stacks, spirals, anchors, off-grid paths, and bursts.</p>
          <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-accent transition group-hover:text-white">Browse patterns <ArrowRight size={16} /></span>
        </Link>
      </div>
    </div>
  );
}
