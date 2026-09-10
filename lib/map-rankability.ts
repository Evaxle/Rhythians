import type { MapPatternSegment } from "@/lib/map-difficulty";

export type RankabilityInput = { noteCount: number | null; activeDurationMs: number; patternSegments: MapPatternSegment[]; directionScore: number; distanceScore: number; npsScore: number; sourceStatus?: "ranked" | "unranked" | "legacy" };
export type RankabilityFactor = { key: string; label: string; score: number; weight: number; contribution: number; reason: string };
export type RankabilityBreakdown = { score: number; rawScore: number; factors: RankabilityFactor[]; strengths: string[]; limitations: string[]; rankedFloorApplied: boolean };
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * 100) / 100;
function percentile(values: number[], p: number) { if (!values.length) return 0; const sorted = [...values].sort((a, b) => a - b); const position = clamp(p) * (sorted.length - 1); const low = Math.floor(position); const high = Math.ceil(position); if (low === high) return sorted[low]; return sorted[low] * (high - position) + sorted[high] * (position - low); }
function variation(values: number[], scale: number) { if (values.length < 2) return 0; const mean = values.reduce((a, b) => a + b, 0) / values.length; const sd = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length); return clamp(sd / Math.max(scale, Math.abs(mean), 0.01)); }
function factor(key: string, label: string, quality: number, weight: number, reason: string): RankabilityFactor { const safe = clamp(quality); return { key, label, score: round(1 + 4 * safe), weight, contribution: round(safe * weight * 4), reason }; }

export function mapRankabilityBreakdown(input: RankabilityInput): RankabilityBreakdown {
  const segments = input.patternSegments.filter((segment) => Number.isFinite(segment.startMs) && Number.isFinite(segment.endMs) && segment.endMs > segment.startMs);
  const active = segments.filter((segment) => segment.pattern !== "rest");
  const strains = active.map((s) => Math.max(0, s.averageStrain));
  const nps = active.map((s) => Math.min(22, Math.max(0, s.averageNps)));
  const directions = active.map((s) => clamp(s.direction));
  const distances = active.map((s) => clamp(s.distance));
  const p50 = percentile(strains, 0.5), p80 = percentile(strains, 0.8), p95 = percentile(strains, 0.95);
  const strainBalance = p95 > 0 ? clamp(0.55 * p50 / p95 + 0.45 * p80 / p95) : 0;
  const npsBalance = 1 - variation(nps, 6), directionBalance = 1 - variation(directions, 0.35), distanceBalance = 1 - variation(distances, 0.35);
  let abrupt = 0;
  if (active.length > 1) { for (let i = 1; i < active.length; i += 1) { const a = active[i - 1], b = active[i]; abrupt += 0.42 * clamp(Math.abs(Math.min(22, a.averageNps) - Math.min(22, b.averageNps)) / 10) + 0.33 * Math.abs(clamp(a.direction) - clamp(b.direction)) + 0.25 * Math.abs(clamp(a.distance) - clamp(b.distance)); } abrupt /= active.length - 1; }
  const patternFlow = clamp(1 - abrupt);
  const timingRegularity = clamp(0.62 * npsBalance + 0.38 * patternFlow);
  const movementCoherence = clamp(0.48 * directionBalance + 0.42 * distanceBalance + 0.10 * patternFlow);
  const patternKinds = new Set(active.map((s) => s.pattern)).size;
  const representative = active.length ? clamp(0.55 * Math.min(1, active.length / 8) + 0.25 * Math.min(1, patternKinds / 4) + 0.20 * Math.min(1, Math.max(0, input.noteCount ?? 0) / 220)) : 0;
  const factors = [
    factor("strain", "Difficulty balance", strainBalance, 0.23, `Median and sustained strain are ${strainBalance >= 0.75 ? "well aligned" : strainBalance >= 0.5 ? "partly aligned" : "far below"} the map's peak strain. Isolated difficulty spikes reduce this score.`),
    factor("nps", "NPS pacing balance", npsBalance, 0.18, `Section-to-section NPS is ${npsBalance >= 0.75 ? "stable" : npsBalance >= 0.5 ? "moderately variable" : "highly irregular"} after clamping extreme micro-gap outliers.`),
    factor("direction", "Direction-change balance", directionBalance, 0.16, `Direction changes are ${directionBalance >= 0.75 ? "coherent across sections" : "uneven across the map"}. Abrupt, isolated reversals reduce competitive consistency.`),
    factor("distance", "Distance / magnitude balance", distanceBalance, 0.15, `Movement magnitude is ${distanceBalance >= 0.75 ? "consistently mapped" : "uneven between sections"}, using the same logistic distance signal as difficulty analysis.`),
    factor("timing", "Timing regularity", timingRegularity, 0.11, `Local timing/NPS flow is ${timingRegularity >= 0.75 ? "coherent" : "irregular"}. This is the current off-grid proxy until BPM/beat-grid metadata is retained.`),
    factor("flow", "Pattern flow", patternFlow, 0.10, `Adjacent sections ${patternFlow >= 0.75 ? "transition cleanly" : "change abruptly"} across speed, direction, and distance.`),
    factor("sample", "Representative analysis", representative, 0.07, `${input.noteCount ?? 0} notes and ${active.length} active pattern segments provide the supporting sample. This factor is intentionally small so long maps are not automatically more rankable.`),
  ];
  void movementCoherence;
  const quality = factors.reduce((sum, item) => sum + ((item.score - 1) / 4) * item.weight, 0);
  const rawScore = round(1 + 4 * clamp(quality));
  const strongest = [...factors].sort((a, b) => b.score - a.score).slice(0, 3), weakest = [...factors].sort((a, b) => a.score - b.score).slice(0, 3);
  return { score: rawScore, rawScore, factors, strengths: strongest.filter((item) => item.score >= 3.5).map((item) => `${item.label}: ${item.score.toFixed(2)}/5.00`), limitations: weakest.filter((item) => item.score < 4.25).map((item) => `${item.label}: ${item.score.toFixed(2)}/5.00 — ${item.reason}`), rankedFloorApplied: false };
}
export function mapRankability(input: RankabilityInput) { return mapRankabilityBreakdown(input).score; }
