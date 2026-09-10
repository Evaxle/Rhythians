"use client";

import { useMemo, useState } from "react";
import { Activity, ArrowUpRight, ChevronDown, ChevronUp, Gauge, Route, TimerReset, Waves } from "lucide-react";
import { RANKS, rankIndexForRating } from "@/lib/ranks";
import type { MapPatternSegment, MapSectionAnalysis } from "@/lib/map-difficulty";

export type MapAnalysisTimelineData = {
  analyzerVersion: number;
  rating: number;
  directionScore: number;
  distanceScore: number;
  npsScore: number;
  staminaIndex: number;
  activeDurationMs: number;
  longestHardSectionMs: number;
  peakJumpNps: number;
  peakStreamNps: number;
  peakJumpStrain: number;
  peakStreamStrain: number;
  jumpRatio: number;
  patternSegments: MapPatternSegment[];
  topSections: MapSectionAnalysis[];
};

function clamp(value: number, min = 0, max = 12) { return Math.min(max, Math.max(min, value)); }
function localRating(strain: number) { return Math.round(clamp(0.35 + 3.9 * Math.log1p(Math.max(0, strain))) * 100) / 100; }
function timeLabel(ms: number) { const total = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`; }
function durationLabel(ms: number) { const seconds = Math.max(0, Math.round(ms / 1000)); return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`; }
function patternName(value: string) { return value === "stream-lean" ? "Stream-leaning" : value === "jump-lean" ? "Jump-leaning" : value === "rest" ? "Break" : value.charAt(0).toUpperCase() + value.slice(1); }
function rankForRating(rating: number) { return RANKS[rankIndexForRating(rating)] ?? RANKS[RANKS.length - 1]; }
function ratingColor(rating: number) { return rankForRating(rating).color; }
function simpleLevel(value: number) { return value >= 7 ? "High" : value >= 4 ? "Medium" : "Low"; }
function segmentReason(segment: MapPatternSegment) {
  if (segment.pattern === "rest") return "A break. It does not lower the difficulty of the active parts around it.";
  const reasons: string[] = [];
  if (segment.averageNps >= 9) reasons.push("very fast notes"); else if (segment.averageNps >= 6) reasons.push("fast notes"); else reasons.push("steadier note speed");
  if (segment.distance >= 0.7) reasons.push("large cursor movement"); else if (segment.distance >= 0.4) reasons.push("medium cursor movement"); else reasons.push("short cursor movement");
  if (segment.direction >= 0.65) reasons.push("sharp turns/reversals"); else if (segment.direction >= 0.35) reasons.push("some direction changes");
  if (segment.jumpness >= 0.7) reasons.push("jump-heavy patterns"); else if (segment.jumpness <= 0.3) reasons.push("stream-heavy patterns");
  return `This part is driven by ${reasons.join(", ")}.`;
}

function FactorCard({ icon, title, score, description }: { icon: React.ReactNode; title: string; score: number; description: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.13em] text-muted">{icon}{title}</div><span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-bold text-white">{simpleLevel(score)}</span></div>
    <div className="mt-3 flex items-end gap-2"><p className="text-2xl font-black text-white">{score.toFixed(1)}</p><p className="pb-1 text-xs text-muted">/ 10</p></div>
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, score * 10)}%` }} /></div>
    <p className="mt-3 text-xs leading-5 text-muted">{description}</p>
  </div>;
}

export function MapAnalysisTimeline({ analysis, isLegacy }: { analysis: MapAnalysisTimelineData; isLegacy: boolean }) {
  const [showAll, setShowAll] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const segments = analysis.patternSegments ?? [];
  const topSections = analysis.topSections ?? [];
  const totalMs = Math.max(1, ...segments.map((segment) => segment.endMs));
  const visibleSegments = showAll ? segments : segments.slice(0, 18);
  const rank = rankForRating(analysis.rating);
  const activeMinutes = analysis.activeDurationMs / 60_000;
  const summary = useMemo(() => {
    const active = segments.filter((segment) => segment.pattern !== "rest");
    const hardest = active.reduce<MapPatternSegment | null>((best, item) => !best || item.peakStrain > best.peakStrain ? item : best, null);
    const jump = active.filter((segment) => segment.jumpness >= 0.6).length;
    const stream = active.filter((segment) => segment.jumpness < 0.4).length;
    return { active: active.length, hardest, jump, stream };
  }, [segments]);

  const staminaMultiplier = 1 + 0.08 * Math.max(0, Math.min(1, analysis.staminaIndex));
  const adjustedCore = Math.max(0, Math.exp((analysis.rating - 0.35) / 3.9) - 1);
  const weightedCore = adjustedCore / staminaMultiplier;

  return <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-surface/95 shadow-glow">
    <div className="border-b border-white/8 bg-gradient-to-br from-accent/[0.12] via-transparent to-transparent p-6 sm:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-accent"><Activity size={15}/> Map difficulty breakdown</p>
          <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Why this map is {analysis.rating.toFixed(2)}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">We look at how fast the notes arrive, how far the cursor has to move, how sharply movement changes direction, and how long the hard parts continue. The hardest and most sustained sections matter more than easy breaks.</p>
          {isLegacy && <p className="mt-2 text-xs text-muted">Legacy analysis is shown for reference only and does not award ranking points.</p>}
        </div>
        <div className="min-w-[190px] rounded-3xl border border-white/10 bg-black/20 p-5 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Final difficulty</p>
          <p className="mt-1 text-4xl font-black" style={{ color: rank.color }}>{analysis.rating.toFixed(2)}</p>
          <p className="mt-1 text-sm font-semibold text-white">{rank.name}</p>
        </div>
      </div>
    </div>

    <div className="space-y-7 p-6 sm:p-8">
      <div>
        <div className="mb-3"><p className="text-sm font-bold text-white">What makes this map difficult?</p><p className="mt-1 text-xs text-muted">These four factors are the easiest way to read the analysis.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FactorCard icon={<Waves size={14}/>} title="Note speed" score={analysis.npsScore} description="How quickly notes arrive during active sections. Long pauses are ignored."/>
          <FactorCard icon={<ArrowUpRight size={14}/>} title="Movement" score={analysis.distanceScore} description="How far the cursor has to travel from note to note. Large jumps raise this."/>
          <FactorCard icon={<Route size={14}/>} title="Direction changes" score={analysis.directionScore} description="How often movement sharply turns or reverses instead of flowing straight."/>
          <FactorCard icon={<TimerReset size={14}/>} title="Stamina" score={analysis.staminaIndex * 10} description={`${durationLabel(analysis.longestHardSectionMs)} longest hard run across ${activeMinutes.toFixed(1)} active minutes.`}/>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-black/15 p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-bold text-white">Difficulty over the whole map</p><p className="mt-1 text-xs text-muted">Each colored block is a section. Harder colors represent a higher local rating; dark gaps are breaks.</p></div><p className="text-[11px] text-muted">{summary.jump} jump-leaning · {summary.stream} stream-leaning</p></div>
        <div className="mt-4 flex h-20 w-full overflow-hidden rounded-2xl border border-white/10 bg-black/30">
          {segments.map((segment, index) => {
            const rating = segment.pattern === "rest" ? 0 : localRating(segment.averageStrain);
            return <div key={`${segment.startMs}-${segment.endMs}-${index}`} title={`${timeLabel(segment.startMs)}–${timeLabel(segment.endMs)} · ${patternName(segment.pattern)}${segment.pattern === "rest" ? "" : ` · local rating ${rating.toFixed(2)}`}`} style={{ width: `${Math.max(0.02, ((segment.endMs - segment.startMs) / totalMs) * 100)}%`, background: segment.pattern === "rest" ? "rgba(255,255,255,.035)" : ratingColor(rating), opacity: segment.pattern === "rest" ? 1 : 0.82 }} />;
          })}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-muted"><span>0:00</span><span>{timeLabel(totalMs / 2)}</span><span>{timeLabel(totalMs)}</span></div>
        {summary.hardest && <div className="mt-4 rounded-2xl border border-accent/15 bg-accent/[0.055] p-4"><p className="text-xs font-bold uppercase tracking-[0.13em] text-accent">Hardest part</p><p className="mt-1 text-sm font-semibold text-white">{timeLabel(summary.hardest.startMs)}–{timeLabel(summary.hardest.endMs)} · {patternName(summary.hardest.pattern)}</p><p className="mt-1 text-xs leading-5 text-muted">{segmentReason(summary.hardest)}</p></div>}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <div className="rounded-3xl border border-white/10 bg-black/15 p-4 sm:p-5">
          <div><p className="text-sm font-bold text-white">Section details</p><p className="mt-1 text-xs text-muted">Use this when you want to see exactly why a certain part was rated harder or easier.</p></div>
          <div className="mt-4 space-y-2.5">
            {visibleSegments.map((segment, index) => {
              const rating = segment.pattern === "rest" ? 0 : localRating(segment.averageStrain);
              return <div key={`${segment.startMs}-${index}`} className="rounded-2xl border border-white/8 bg-white/[0.025] p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-white">{timeLabel(segment.startMs)}–{timeLabel(segment.endMs)} <span className="font-normal text-muted">· {patternName(segment.pattern)}</span></p><p className="mt-1 text-[11px] leading-5 text-muted">{segmentReason(segment)}</p></div><div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-center"><p className="text-[9px] uppercase tracking-wide text-muted">Local</p><p className="text-sm font-black" style={{ color: segment.pattern === "rest" ? undefined : ratingColor(rating) }}>{segment.pattern === "rest" ? "Break" : rating.toFixed(2)}</p></div></div>
                {segment.pattern !== "rest" && <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-muted"><span className="rounded-full border border-white/8 px-2 py-1">{segment.averageNps.toFixed(1)} NPS</span><span className="rounded-full border border-white/8 px-2 py-1">movement {(segment.distance * 10).toFixed(1)}/10</span><span className="rounded-full border border-white/8 px-2 py-1">turns {(segment.direction * 10).toFixed(1)}/10</span><span className="rounded-full border border-white/8 px-2 py-1">{Math.round(segment.jumpness * 100)}% jump</span></div>}
              </div>;
            })}
          </div>
          {segments.length > 18 && <button type="button" onClick={() => setShowAll((value) => !value)} className="mt-4 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10">{showAll ? "Show fewer sections" : `Show all ${segments.length} sections`}</button>}
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-black/15 p-4 sm:p-5"><div className="flex items-center gap-2"><Gauge size={15} className="text-accent"/><p className="text-sm font-bold text-white">How the final number is chosen</p></div><p className="mt-3 text-xs leading-5 text-muted">The analyzer does <strong className="text-white">not</strong> average every second equally. It focuses mostly on the hardest repeated sections, then adds a small stamina adjustment. That keeps breaks and easy intros from making a genuinely hard map look easy.</p><div className="mt-4 grid gap-2"><div className="rounded-xl bg-white/[0.035] p-3 text-xs"><span className="font-bold text-white">55%</span><span className="text-muted"> · near-peak difficulty</span></div><div className="rounded-xl bg-white/[0.035] p-3 text-xs"><span className="font-bold text-white">30%</span><span className="text-muted"> · sustained hard difficulty</span></div><div className="rounded-xl bg-white/[0.035] p-3 text-xs"><span className="font-bold text-white">15%</span><span className="text-muted"> · broader active-map difficulty</span></div><div className="rounded-xl border border-accent/15 bg-accent/[0.05] p-3 text-xs text-muted">Then stamina can raise the core slightly, producing the final <strong className="text-white">{analysis.rating.toFixed(2)}</strong> rating.</div></div></div>

          <div className="rounded-3xl border border-white/10 bg-black/15 p-4 sm:p-5"><p className="text-sm font-bold text-white">Hardest windows</p><div className="mt-3 space-y-2">{topSections.slice(0, 5).map((section, index) => { const rating = localRating(section.strain); return <div key={`${section.startMs}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.025] p-3"><div><p className="text-xs font-semibold text-white">#{index + 1} · {timeLabel(section.startMs)}–{timeLabel(section.endMs)}</p><p className="mt-0.5 text-[10px] text-muted">{patternName(section.pattern)} · {section.nps.toFixed(1)} NPS</p></div><p className="text-base font-black" style={{ color: ratingColor(rating) }}>{rating.toFixed(2)}</p></div>; })}</div></div>

          <button type="button" onClick={() => setShowAdvanced((value) => !value)} className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-left text-xs font-semibold text-white"><span>Advanced analyzer math</span>{showAdvanced ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}</button>
          {showAdvanced && <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-xs leading-6 text-muted"><p>Weighted active core: <strong className="text-white">≈ {weightedCore.toFixed(3)}</strong></p><p>Stamina multiplier: <strong className="text-white">× {staminaMultiplier.toFixed(3)}</strong></p><p>Adjusted strain: <strong className="text-white">≈ {adjustedCore.toFixed(3)}</strong></p><p className="mt-2">Final transform: <strong className="text-white">0.35 + 3.9 × ln(1 + adjusted strain)</strong>, rounded to two decimals.</p></div>}
        </div>
      </div>
    </div>
  </section>;
}