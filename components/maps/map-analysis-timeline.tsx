"use client";

import { useMemo, useState } from "react";
import { Activity, ArrowUpRight, Gauge, Route, TimerReset, Waves } from "lucide-react";
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
function durationLabel(ms: number) { if (ms < 60_000) return `${Math.round(ms / 1000)}s`; const seconds = Math.round(ms / 1000); return `${Math.floor(seconds / 60)}m ${seconds % 60}s`; }
function patternName(value: string) { return value === "stream-lean" ? "Stream lean" : value === "jump-lean" ? "Jump lean" : value === "rest" ? "Rest" : value.charAt(0).toUpperCase() + value.slice(1); }
function ratingColor(rating: number) { return RANKS[rankIndexForRating(rating)]?.color ?? RANKS[RANKS.length - 1].color; }
function difficultyWord(rating: number) {
  const rank = RANKS[rankIndexForRating(rating)] ?? RANKS[RANKS.length - 1];
  return `${rank.name} difficulty`;
}
function factorLabel(value: number, low: string, medium: string, high: string) { return value >= 0.72 ? high : value >= 0.4 ? medium : low; }
function segmentReason(segment: MapPatternSegment) {
  if (segment.pattern === "rest") return "Break/rest section. It adds no active strain, so it does not drag the active-window difficulty average down.";
  const reasons = [
    factorLabel(segment.averageNps / 12, "slower timing", "moderate timing speed", "fast local NPS"),
    factorLabel(segment.distance, "short cursor travel", "mixed spacing", "large cursor travel"),
    factorLabel(segment.direction, "simple direction flow", "noticeable direction changes", "sharp direction changes/reversals"),
  ];
  if (segment.jumpness >= 0.72) reasons.push("jump-heavy movement");
  else if (segment.jumpness <= 0.28) reasons.push("stream-heavy movement");
  return `${reasons.join(" + ")} produce this section's local strain.`;
}
function sectionReason(section: MapSectionAnalysis) {
  const reasons = [];
  if (section.nps >= 10) reasons.push("very high local NPS"); else if (section.nps >= 6) reasons.push("high local NPS"); else reasons.push("moderate timing speed");
  if (section.distance >= 0.72) reasons.push("large spacing"); else if (section.distance >= 0.4) reasons.push("mixed spacing"); else reasons.push("compact spacing");
  if (section.direction >= 0.68) reasons.push("hard direction changes"); else if (section.direction >= 0.35) reasons.push("moderate direction changes"); else reasons.push("simple direction flow");
  return reasons.join(" + ");
}

export function MapAnalysisTimeline({ analysis, isLegacy }: { analysis: MapAnalysisTimelineData; isLegacy: boolean }) {
  const [showAll, setShowAll] = useState(false);
  const segments = analysis.patternSegments ?? [];
  const topSections = analysis.topSections ?? [];
  const totalMs = Math.max(1, ...segments.map((segment) => segment.endMs));
  const visibleSegments = showAll ? segments : segments.slice(0, 24);
  const staminaMultiplier = 1 + 0.08 * Math.max(0, Math.min(1, analysis.staminaIndex));
  const adjustedCore = Math.max(0, Math.exp((analysis.rating - 0.35) / 3.9) - 1);
  const weightedCore = adjustedCore / staminaMultiplier;
  const activeMinutes = analysis.activeDurationMs / 60_000;
  const timelineSummary = useMemo(() => {
    const active = segments.filter((segment) => segment.pattern !== "rest");
    const jump = active.filter((segment) => segment.jumpness >= 0.6).length;
    const stream = active.filter((segment) => segment.jumpness < 0.4).length;
    return { active: active.length, jump, stream };
  }, [segments]);

  return <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow sm:p-8">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-accent"><Activity size={16} /> Difficulty analysis timeline</p>
        <h2 className="mt-1 text-2xl font-semibold text-white">Why this map is rated {analysis.rating.toFixed(2)}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Analyzer v{analysis.analyzerVersion} evaluates movement direction, cursor distance, local NPS and sustained strain in 1.5-second active windows. {isLegacy ? "This legacy map keeps its analyzed difficulty for archive/reference purposes and does not award rank points." : "This ranked map uses the same analyzed rating that determines its rank and map rewards."}</p>
      </div>
      <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-right"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Final analyzed rating</p><p className="mt-1 text-3xl font-black" style={{ color: ratingColor(analysis.rating) }}>{analysis.rating.toFixed(2)}</p><p className="text-xs text-muted">{difficultyWord(analysis.rating)}</p></div>
    </div>

    <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-2xl border border-white/10 bg-black/15 p-4"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted"><Route size={14} /> Direction</div><p className="mt-2 text-2xl font-bold text-white">{analysis.directionScore.toFixed(2)}<span className="text-sm text-muted"> / 10</span></p><p className="mt-1 text-xs leading-5 text-muted">Higher means more sharp turns and reversals instead of simple straight flow.</p></div>
      <div className="rounded-2xl border border-white/10 bg-black/15 p-4"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted"><ArrowUpRight size={14} /> Distance</div><p className="mt-2 text-2xl font-bold text-white">{analysis.distanceScore.toFixed(2)}<span className="text-sm text-muted"> / 10</span></p><p className="mt-1 text-xs leading-5 text-muted">Higher means larger cursor movement; extreme edge spacing is flattened by the distance curve.</p></div>
      <div className="rounded-2xl border border-white/10 bg-black/15 p-4"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted"><Waves size={14} /> Relative NPS</div><p className="mt-2 text-2xl font-bold text-white">{analysis.npsScore.toFixed(2)}<span className="text-sm text-muted"> / 10</span></p><p className="mt-1 text-xs leading-5 text-muted">Uses note-to-note timing only; long empty sections never lower this score.</p></div>
      <div className="rounded-2xl border border-white/10 bg-black/15 p-4"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted"><TimerReset size={14} /> Stamina</div><p className="mt-2 text-2xl font-bold text-white">{(analysis.staminaIndex * 100).toFixed(0)}%</p><p className="mt-1 text-xs leading-5 text-muted">{durationLabel(analysis.longestHardSectionMs)} longest hard run across {activeMinutes.toFixed(1)} active minutes.</p></div>
    </div>

    <div className="mt-6 rounded-2xl border border-white/10 bg-black/15 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-muted">Full map timeline</p><p className="mt-1 text-sm text-white">{timelineSummary.active} active pattern sections · {timelineSummary.jump} jump-leaning · {timelineSummary.stream} stream-leaning</p></div><p className="text-xs text-muted">Color = estimated local difficulty</p></div>
      <div className="mt-4 flex h-16 w-full overflow-hidden rounded-xl border border-white/10 bg-black/30">
        {segments.map((segment, index) => {
          const rating = segment.pattern === "rest" ? 0 : localRating(segment.averageStrain);
          return <div key={`${segment.startMs}-${segment.endMs}-${index}`} title={`${timeLabel(segment.startMs)}–${timeLabel(segment.endMs)} · ${patternName(segment.pattern)} · ${segment.pattern === "rest" ? "rest" : `${rating.toFixed(2)} rating · ${segment.averageNps.toFixed(2)} NPS`}`} style={{ width: `${Math.max(0.02, ((segment.endMs - segment.startMs) / totalMs) * 100)}%`, background: segment.pattern === "rest" ? "rgba(255,255,255,.035)" : ratingColor(rating), opacity: segment.pattern === "rest" ? 1 : 0.78 }} />;
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted"><span>0:00</span><span>{timeLabel(totalMs / 2)}</span><span>{timeLabel(totalMs)}</span></div>
    </div>

    <div className="mt-6 grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <div className="rounded-2xl border border-white/10 bg-black/15 p-4 sm:p-5">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-muted">Section-by-section details</p>
        <div className="mt-3 space-y-2">
          {visibleSegments.map((segment, index) => {
            const rating = segment.pattern === "rest" ? 0 : localRating(segment.averageStrain);
            const peak = segment.pattern === "rest" ? 0 : localRating(segment.peakStrain);
            return <div key={`${segment.startMs}-${index}`} className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
              <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-semibold text-white">{timeLabel(segment.startMs)}–{timeLabel(segment.endMs)} · {patternName(segment.pattern)}</p><p className="mt-1 text-[11px] leading-5 text-muted">{segmentReason(segment)}</p></div><div className="text-right"><p className="text-sm font-black" style={{ color: segment.pattern === "rest" ? undefined : ratingColor(rating) }}>{segment.pattern === "rest" ? "Rest" : rating.toFixed(2)}</p>{segment.pattern !== "rest" && <p className="text-[10px] text-muted">peak {peak.toFixed(2)}</p>}</div></div>
              {segment.pattern !== "rest" && <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-muted"><span className="rounded-full border border-white/8 px-2 py-1">{segment.averageNps.toFixed(2)} NPS</span><span className="rounded-full border border-white/8 px-2 py-1">distance {(segment.distance * 10).toFixed(1)}/10</span><span className="rounded-full border border-white/8 px-2 py-1">direction {(segment.direction * 10).toFixed(1)}/10</span><span className="rounded-full border border-white/8 px-2 py-1">jumpness {(segment.jumpness * 100).toFixed(0)}%</span></div>}
            </div>;
          })}
        </div>
        {segments.length > 24 && <button type="button" onClick={() => setShowAll((value) => !value)} className="mt-3 rounded-full border border-accent/30 bg-accent/[0.07] px-4 py-2 text-xs font-semibold text-white">{showAll ? "Show first 24 sections" : `Show all ${segments.length} sections`}</button>}
      </div>

      <div className="space-y-5">
        <div className="rounded-2xl border border-white/10 bg-black/15 p-4 sm:p-5">
          <div className="flex items-center gap-2"><Gauge size={15} className="text-accent" /><p className="text-xs font-bold uppercase tracking-[0.15em] text-muted">How the final rating is produced</p></div>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3"><span className="text-muted">Peak-window weight</span><span className="font-semibold text-white">55% of P95 strain</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted">Sustained-hard weight</span><span className="font-semibold text-white">30% of P80 strain</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted">Active-map weight</span><span className="font-semibold text-white">15% of P60 strain</span></div>
            <div className="border-t border-white/10 pt-3"><div className="flex items-center justify-between gap-3"><span className="text-muted">Weighted active core</span><span className="font-semibold text-white">≈ {weightedCore.toFixed(3)}</span></div><div className="mt-2 flex items-center justify-between gap-3"><span className="text-muted">Stamina multiplier</span><span className="font-semibold text-white">× {staminaMultiplier.toFixed(3)}</span></div><div className="mt-2 flex items-center justify-between gap-3"><span className="text-muted">Adjusted core</span><span className="font-semibold text-white">≈ {adjustedCore.toFixed(3)}</span></div></div>
            <div className="rounded-xl border border-accent/20 bg-accent/[0.06] p-3 text-xs leading-5 text-muted">Final transform: <span className="font-semibold text-white">0.35 + 3.9 × ln(1 + adjusted strain)</span>, clamped to the analyzer scale and rounded to two decimals. Pauses are excluded from active strain, so a long empty section cannot make a hard map artificially easier.</div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/15 p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-muted">Hardest analyzed windows</p>
          <div className="mt-3 space-y-2">{topSections.slice(0, 8).map((section, index) => { const rating = localRating(section.strain); return <div key={`${section.startMs}-${index}`} className="rounded-xl border border-white/8 bg-white/[0.025] p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-white">#{index + 1} · {timeLabel(section.startMs)}–{timeLabel(section.endMs)}</p><p className="mt-1 text-[11px] leading-5 text-muted">{patternName(section.pattern)} · {sectionReason(section)}</p></div><div className="text-right"><p className="text-base font-black" style={{ color: ratingColor(rating) }}>{rating.toFixed(2)}</p><p className="text-[10px] text-muted">local rating</p></div></div><div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-muted"><span>{section.nps.toFixed(2)} NPS</span><span>·</span><span>{(section.jumpness * 100).toFixed(0)}% jumpness</span></div></div>; })}</div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl border border-white/8 p-3"><p className="text-muted">Peak jump</p><p className="mt-1 font-semibold text-white">{analysis.peakJumpNps.toFixed(2)} NPS · strain {analysis.peakJumpStrain.toFixed(2)}</p></div><div className="rounded-xl border border-white/8 p-3"><p className="text-muted">Peak stream</p><p className="mt-1 font-semibold text-white">{analysis.peakStreamNps.toFixed(2)} NPS · strain {analysis.peakStreamStrain.toFixed(2)}</p></div></div>
        </div>
      </div>
    </div>
  </section>;
}
