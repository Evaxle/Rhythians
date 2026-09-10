"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Activity, AlertTriangle, ArrowUpRight, CheckCircle2, ChevronDown, ChevronUp, Gauge, Route, ShieldCheck, ShieldX, TimerReset, Waves } from "lucide-react";
import { RANKS, rankIndexForRating } from "@/lib/ranks";
import type { MapPatternSegment, MapSectionAnalysis } from "@/lib/map-difficulty";
import type { MapPatternProfile, RankabilityIssue, RankabilityMetric } from "@/lib/map-rankability";

export type MapAnalysisTimelineData = {
  analyzerVersion: number;
  rankabilityVersion: number;
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
  rankabilityScore: number;
  rankabilityColor: string;
  rankabilityLabel: string;
  rankabilitySummary: string;
  rankabilityMetrics: RankabilityMetric[];
  rankabilityIssues: RankabilityIssue[];
  patternProfile: MapPatternProfile | null;
  pointEligible: boolean;
  sourceStatus: "ranked" | "legacy";
};

const rankabilityTheme = {
  green: { border: "border-emerald-400/30", background: "bg-emerald-400/10", text: "text-emerald-200" },
  yellow: { border: "border-yellow-400/30", background: "bg-yellow-400/10", text: "text-yellow-200" },
  orange: { border: "border-orange-400/30", background: "bg-orange-400/10", text: "text-orange-200" },
  red: { border: "border-red-400/30", background: "bg-red-400/10", text: "text-red-200" },
} as const;

function clamp(value: number, min = 0, max = 12) { return Math.min(max, Math.max(min, value)); }
function localRating(strain: number) { return Math.round(clamp(0.35 + 3.9 * Math.log1p(Math.max(0, strain))) * 100) / 100; }
function timeLabel(ms: number) { const total = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`; }
function durationLabel(ms: number) { const seconds = Math.max(0, Math.round(ms / 1000)); return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`; }
function patternName(value: string) { return value === "stream-lean" ? "Stream-leaning" : value === "jump-lean" ? "Jump-leaning" : value === "rest" ? "Break" : value.charAt(0).toUpperCase() + value.slice(1); }
function rankForRating(rating: number) { return RANKS[rankIndexForRating(rating)] ?? RANKS[RANKS.length - 1]; }
function ratingColor(rating: number) { return rankForRating(rating).color; }
function simpleLevel(value: number) { return value >= 7 ? "High" : value >= 4 ? "Medium" : "Low"; }
function metricPercent(score: number) { return Math.round(Math.max(0, Math.min(1, score)) * 100); }
function themeFor(color: string) { return rankabilityTheme[color as keyof typeof rankabilityTheme] ?? rankabilityTheme.red; }
function issueTheme(severity: number) { return severity >= 0.75 ? "border-red-400/25 bg-red-400/[0.07]" : severity >= 0.5 ? "border-orange-400/25 bg-orange-400/[0.06]" : "border-yellow-400/20 bg-yellow-400/[0.05]"; }
function segmentReason(segment: MapPatternSegment) {
  if (segment.pattern === "rest") return "Break / inactive section. It does not lower the difficulty of the active patterns around it.";
  const reasons: string[] = [];
  if (segment.averageNps >= 9) reasons.push("very fast notes"); else if (segment.averageNps >= 6) reasons.push("fast notes"); else reasons.push("steadier note speed");
  if (segment.distance >= 0.7) reasons.push("large cursor movement"); else if (segment.distance >= 0.4) reasons.push("medium cursor movement"); else reasons.push("short cursor movement");
  if (segment.direction >= 0.65) reasons.push("sharp turns/reversals"); else if (segment.direction >= 0.35) reasons.push("some direction changes");
  if (segment.jumpness >= 0.7) reasons.push("jump-heavy patterns"); else if (segment.jumpness <= 0.3) reasons.push("stream-heavy patterns");
  return `Driven by ${reasons.join(", ")}.`;
}

function FactorCard({ icon, title, score, description }: { icon: ReactNode; title: string; score: number; description: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.13em] text-muted">{icon}{title}</div><span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-bold text-white">{simpleLevel(score)}</span></div><div className="mt-3 flex items-end gap-2"><p className="text-2xl font-black text-white">{score.toFixed(1)}</p><p className="pb-1 text-xs text-muted">/ 10</p></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, score * 10)}%` }} /></div><p className="mt-3 text-xs leading-5 text-muted">{description}</p></div>;
}
function MetricCard({ metric }: { metric: RankabilityMetric }) {
  const percent = metricPercent(metric.score);
  const color = percent >= 80 ? "bg-emerald-400" : percent >= 60 ? "bg-yellow-400" : percent >= 40 ? "bg-orange-400" : "bg-red-400";
  return <div className="rounded-2xl border border-white/10 bg-black/15 p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-white">{metric.label}</p><span className="text-xs font-bold text-white">{percent}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5"><div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} /></div><p className="mt-2 text-xs leading-5 text-muted">{metric.detail}</p></div>;
}
function PatternPill({ name, value }: { name: string; value: number }) { return <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs text-muted"><strong className="text-white">{Math.round(value * 100)}%</strong> {name}</span>; }

export function MapAnalysisTimeline({ analysis, isLegacy }: { analysis: MapAnalysisTimelineData; isLegacy: boolean }) {
  const [showAll, setShowAll] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showAllIssues, setShowAllIssues] = useState(false);
  const segments = analysis.patternSegments ?? [];
  const topSections = analysis.topSections ?? [];
  const issues = analysis.rankabilityIssues ?? [];
  const visibleIssues = showAllIssues ? issues : issues.slice(0, 6);
  const totalMs = Math.max(1, ...segments.map((segment) => segment.endMs));
  const visibleSegments = showAll ? segments : segments.slice(0, 18);
  const rank = rankForRating(analysis.rating);
  const activeMinutes = analysis.activeDurationMs / 60_000;
  const rankTheme = themeFor(analysis.rankabilityColor);
  const summary = useMemo(() => {
    const active = segments.filter((segment) => segment.pattern !== "rest");
    const hardest = active.reduce<MapPatternSegment | null>((best, item) => !best || item.peakStrain > best.peakStrain ? item : best, null);
    return { hardest, jump: active.filter((segment) => segment.jumpness >= 0.6).length, stream: active.filter((segment) => segment.jumpness < 0.4).length };
  }, [segments]);

  return <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-surface/95 shadow-glow">
    <div className="border-b border-white/8 bg-gradient-to-br from-accent/[0.12] via-transparent to-transparent p-6 sm:p-8"><div className="grid gap-4 lg:grid-cols-[1fr_190px_220px] lg:items-stretch"><div className="max-w-3xl self-center"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-accent"><Activity size={15}/> Map analysis</p><h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Difficulty and ranked-map quality</h2><p className="mt-2 text-sm leading-6 text-muted">Difficulty answers <strong className="text-white">“how hard is it?”</strong> Rankability answers <strong className="text-white">“is that difficulty delivered clearly and fairly enough for competitive points?”</strong></p></div><div className="rounded-3xl border border-white/10 bg-black/20 p-5 text-center"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Difficulty</p><p className="mt-1 text-4xl font-black" style={{ color: rank.color }}>{analysis.rating.toFixed(2)}</p><p className="mt-1 text-sm font-semibold text-white">{rank.name}</p></div><div className={`rounded-3xl border p-5 text-center ${rankTheme.border} ${rankTheme.background}`}><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Rankability</p><p className={`mt-1 text-4xl font-black ${rankTheme.text}`}>{analysis.rankabilityScore.toFixed(2)}<span className="text-lg text-muted">/5</span></p><p className="mt-1 text-sm font-semibold text-white">{analysis.rankabilityLabel}</p></div></div></div>
    <div className="space-y-8 p-6 sm:p-8">
      <div className={`rounded-3xl border p-5 ${rankTheme.border} ${rankTheme.background}`}><div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div className="max-w-3xl"><p className={`flex items-center gap-2 text-sm font-bold ${rankTheme.text}`}>{analysis.rankabilityScore >= 4 ? <ShieldCheck size={17}/> : <ShieldX size={17}/>} Why the map scored {analysis.rankabilityScore.toFixed(2)}/5</p><p className="mt-2 text-sm leading-6 text-white/90">{analysis.rankabilitySummary}</p></div><div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm"><p className="text-xs text-muted">Ranking points</p><p className={`mt-1 font-bold ${analysis.pointEligible ? "text-emerald-300" : "text-muted"}`}>{analysis.pointEligible ? "Enabled" : "Not enabled"}</p></div></div><p className="mt-4 text-xs leading-5 text-muted">A score of <strong className="text-white">4.00+</strong> is required before a Ranked or Legacy map can award RPL, RPV, RPS and RHP. A 3.xx map can be playable but needs cleanup; 2.xx is unconventional/messy; 1.xx contains major competitive-readability problems.</p>{isLegacy && <p className="mt-2 text-xs text-muted">Legacy is an archive status, not a point ban. A Legacy map can award points when it passes the same 4.00+ quality gate and its point switch is enabled.</p>}</div>
      <div><div className="mb-3"><p className="text-sm font-bold text-white">Competitive quality checks</p><p className="mt-1 text-xs text-muted">These are separate from raw difficulty. High values mean the map is cleaner and more predictable to compete on.</p></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{analysis.rankabilityMetrics.map((metric) => <MetricCard key={metric.key} metric={metric}/>)}</div>{analysis.patternProfile && <div className="mt-4 flex flex-wrap gap-2"><PatternPill name="stream-like" value={analysis.patternProfile.streamRatio}/><PatternPill name="jumps" value={analysis.patternProfile.jumpRatio}/><PatternPill name="tech" value={analysis.patternProfile.techRatio}/><PatternPill name="vibro" value={analysis.patternProfile.vibroRatio}/><PatternPill name="quantum" value={analysis.patternProfile.quantumRatio}/><PatternPill name="off-grid" value={analysis.patternProfile.offGridRatio}/></div>}</div>
      <div className="rounded-3xl border border-white/10 bg-black/15 p-4 sm:p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-bold text-white">Mapper feedback: where quality drops</p><p className="mt-1 text-xs text-muted">These timestamps identify the sections that most reduced rankability.</p></div><span className="text-xs text-muted">{issues.length} flagged area{issues.length === 1 ? "" : "s"}</span></div>{issues.length === 0 ? <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4 text-sm text-emerald-200"><CheckCircle2 size={18}/> No significant competitive-readability issues were detected.</div> : <div className="mt-4 space-y-2">{visibleIssues.map((entry, index) => <div key={`${entry.type}-${entry.startMs}-${index}`} className={`rounded-2xl border p-4 ${issueTheme(entry.severity)}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-sm font-semibold text-white"><AlertTriangle size={14} className="text-orange-300"/>{entry.title}</p><p className="mt-1 text-xs leading-5 text-muted">{entry.detail}</p></div><span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-bold text-white">{timeLabel(entry.startMs)}–{timeLabel(entry.endMs)}</span></div></div>)}</div>}{issues.length > 6 && <button type="button" onClick={() => setShowAllIssues((current) => !current)} className="mt-4 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white">{showAllIssues ? "Show fewer issues" : `Show all ${issues.length} issues`}</button>}</div>
      <div><div className="mb-3"><p className="text-sm font-bold text-white">What makes this map difficult?</p><p className="mt-1 text-xs text-muted">These four factors explain the separate difficulty rating.</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><FactorCard icon={<Waves size={14}/>} title="Note speed" score={analysis.npsScore} description="How quickly notes arrive during active sections. Long pauses are ignored."/><FactorCard icon={<ArrowUpRight size={14}/>} title="Movement" score={analysis.distanceScore} description="How far the cursor travels from note to note. Large jumps raise this."/><FactorCard icon={<Route size={14}/>} title="Direction changes" score={analysis.directionScore} description="How sharply movement turns or reverses instead of flowing straight."/><FactorCard icon={<TimerReset size={14}/>} title="Stamina" score={analysis.staminaIndex * 10} description={`${durationLabel(analysis.longestHardSectionMs)} longest hard run across ${activeMinutes.toFixed(1)} active minutes.`}/></div></div>
      <div className="rounded-3xl border border-white/10 bg-black/15 p-4 sm:p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-bold text-white">Difficulty over the whole map</p><p className="mt-1 text-xs text-muted">Harder colors are higher local difficulty; dark gaps are breaks.</p></div><p className="text-[11px] text-muted">{summary.jump} jump-leaning · {summary.stream} stream-leaning sections</p></div><div className="mt-4 flex h-20 w-full overflow-hidden rounded-2xl border border-white/10 bg-black/30">{segments.map((segment, index) => { const rating = segment.pattern === "rest" ? 0 : localRating(segment.averageStrain); return <div key={`${segment.startMs}-${segment.endMs}-${index}`} title={`${timeLabel(segment.startMs)}–${timeLabel(segment.endMs)} · ${patternName(segment.pattern)}${segment.pattern === "rest" ? "" : ` · local rating ${rating.toFixed(2)}`}`} style={{ width: `${Math.max(0.02, ((segment.endMs - segment.startMs) / totalMs) * 100)}%`, background: segment.pattern === "rest" ? "rgba(255,255,255,.035)" : ratingColor(rating), opacity: segment.pattern === "rest" ? 1 : 0.82 }} />; })}</div><div className="mt-2 flex justify-between text-[10px] text-muted"><span>0:00</span><span>{timeLabel(totalMs / 2)}</span><span>{timeLabel(totalMs)}</span></div>{summary.hardest && <div className="mt-4 rounded-2xl border border-accent/15 bg-accent/[0.055] p-4"><p className="text-xs font-bold uppercase tracking-[0.13em] text-accent">Hardest part</p><p className="mt-1 text-sm font-semibold text-white">{timeLabel(summary.hardest.startMs)}–{timeLabel(summary.hardest.endMs)} · {patternName(summary.hardest.pattern)}</p><p className="mt-1 text-xs leading-5 text-muted">{segmentReason(summary.hardest)}</p></div>}</div>
      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]"><div className="rounded-3xl border border-white/10 bg-black/15 p-4 sm:p-5"><p className="text-sm font-bold text-white">Section-by-section difficulty</p><div className="mt-4 space-y-2.5">{visibleSegments.map((segment, index) => { const rating = segment.pattern === "rest" ? 0 : localRating(segment.averageStrain); return <div key={`${segment.startMs}-${index}`} className="rounded-2xl border border-white/8 bg-white/[0.025] p-3.5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-white">{timeLabel(segment.startMs)}–{timeLabel(segment.endMs)} <span className="font-normal text-muted">· {patternName(segment.pattern)}</span></p><p className="mt-1 text-[11px] leading-5 text-muted">{segmentReason(segment)}</p></div><div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-center"><p className="text-[9px] uppercase tracking-wide text-muted">Local</p><p className="text-sm font-black" style={{ color: segment.pattern === "rest" ? undefined : ratingColor(rating) }}>{segment.pattern === "rest" ? "Break" : rating.toFixed(2)}</p></div></div>{segment.pattern !== "rest" && <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-muted"><span className="rounded-full border border-white/8 px-2 py-1">{segment.averageNps.toFixed(1)} NPS</span><span className="rounded-full border border-white/8 px-2 py-1">movement {(segment.distance * 10).toFixed(1)}/10</span><span className="rounded-full border border-white/8 px-2 py-1">turns {(segment.direction * 10).toFixed(1)}/10</span><span className="rounded-full border border-white/8 px-2 py-1">{Math.round(segment.jumpness * 100)}% jump</span></div>}</div>; })}</div>{segments.length > 18 && <button type="button" onClick={() => setShowAll((current) => !current)} className="mt-4 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white">{showAll ? "Show fewer sections" : `Show all ${segments.length} sections`}</button>}</div><div className="space-y-4"><div className="rounded-3xl border border-white/10 bg-black/15 p-5"><div className="flex items-center gap-2"><Gauge size={15} className="text-accent"/><p className="text-sm font-bold text-white">How the final difficulty is chosen</p></div><p className="mt-3 text-xs leading-5 text-muted">The final rating focuses on repeated hard sections instead of averaging easy breaks into the score: 55% near-peak strain, 30% sustained hard strain, 15% broader active strain, followed by a small stamina adjustment.</p></div><div className="rounded-3xl border border-white/10 bg-black/15 p-5"><p className="text-sm font-bold text-white">Hardest windows</p><div className="mt-3 space-y-2">{topSections.slice(0, 5).map((section, index) => { const rating = localRating(section.strain); return <div key={`${section.startMs}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.025] p-3"><div><p className="text-xs font-semibold text-white">#{index + 1} · {timeLabel(section.startMs)}–{timeLabel(section.endMs)}</p><p className="mt-0.5 text-[10px] text-muted">{patternName(section.pattern)} · {section.nps.toFixed(1)} NPS</p></div><p className="text-base font-black" style={{ color: ratingColor(rating) }}>{rating.toFixed(2)}</p></div>; })}</div></div></div></div>
      <button type="button" onClick={() => setShowAdvanced((current) => !current)} className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-left text-xs font-semibold text-white"><span>Advanced analyzer information</span>{showAdvanced ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}</button>{showAdvanced && <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/15 p-4 text-xs sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-muted">Difficulty analyzer</p><p className="mt-1 font-bold text-white">v{analysis.analyzerVersion}</p></div><div><p className="text-muted">Rankability analyzer</p><p className="mt-1 font-bold text-white">v{analysis.rankabilityVersion}</p></div><div><p className="text-muted">Peak jump NPS</p><p className="mt-1 font-bold text-white">{analysis.peakJumpNps.toFixed(2)}</p></div><div><p className="text-muted">Peak stream NPS</p><p className="mt-1 font-bold text-white">{analysis.peakStreamNps.toFixed(2)}</p></div><div><p className="text-muted">Peak jump strain</p><p className="mt-1 font-bold text-white">{analysis.peakJumpStrain.toFixed(2)}</p></div><div><p className="text-muted">Peak stream strain</p><p className="mt-1 font-bold text-white">{analysis.peakStreamStrain.toFixed(2)}</p></div><div><p className="text-muted">Jump ratio</p><p className="mt-1 font-bold text-white">{Math.round(analysis.jumpRatio * 100)}%</p></div><div><p className="text-muted">Point source</p><p className="mt-1 font-bold capitalize text-white">{analysis.sourceStatus}</p></div></div>}
    </div>
  </section>;
}
