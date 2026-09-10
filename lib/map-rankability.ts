import type { MapPatternSegment } from "@/lib/map-difficulty";

export type RankabilityInput = {
  noteCount: number | null;
  activeDurationMs: number;
  patternSegments: MapPatternSegment[];
  directionScore: number;
  distanceScore: number;
  npsScore: number;
  sourceStatus?: "ranked" | "unranked" | "legacy";
};

export type RankabilityFactor = {
  key: string;
  label: string;
  score: number;
  weight: number;
  contribution: number;
  reason: string;
};

export type RankabilityBreakdown = {
  score: number;
  rawScore: number;
  factors: RankabilityFactor[];
  strengths: string[];
  limitations: string[];
  rankedFloorApplied: boolean;
};

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const position = clamp(p) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const amount = position - lower;
  return sorted[lower] * (1 - amount) + sorted[upper] * amount;
}

function factor(key: string, label: string, score: number, weight: number, reason: string): RankabilityFactor {
  const safe = clamp(score);
  return { key, label, score: round(safe * 5), weight, contribution: round(safe * weight * 4), reason };
}

export function mapRankabilityBreakdown(input: RankabilityInput): RankabilityBreakdown {
  const segments = input.patternSegments.filter((segment) => Number.isFinite(segment.startMs) && Number.isFinite(segment.endMs) && segment.endMs > segment.startMs);
  const active = segments.filter((segment) => segment.pattern !== "rest");
  const totalDuration = segments.length ? Math.max(...segments.map((segment) => segment.endMs)) : input.activeDurationMs;
  const activeCoverage = totalDuration > 0 ? clamp(input.activeDurationMs / totalDuration) : 0;
  const notes = Math.max(0, input.noteCount ?? 0);
  const noteConfidence = clamp((notes - 40) / 210);
  const durationConfidence = clamp((input.activeDurationMs - 20_000) / 55_000);
  const strains = active.map((segment) => Math.max(0, segment.averageStrain));
  const p50 = percentile(strains, 0.5);
  const p80 = percentile(strains, 0.8);
  const p95 = percentile(strains, 0.95);
  const consistency = p95 > 0 ? clamp((0.55 * (p50 / p95) + 0.45 * (p80 / p95)) / 0.72) : 0;
  const movementSignal = clamp((Math.max(0, input.directionScore) + Math.max(0, input.distanceScore)) / 11);
  const timingSignal = clamp(Math.max(0, input.npsScore) / 5.5);
  const patternVariety = active.length ? clamp(new Set(active.map((segment) => segment.pattern)).size / 4) : 0;
  const factors = [
    factor("notes", "Analyzable note sample", noteConfidence, 0.22, `${notes.toLocaleString()} notes provide ${noteConfidence >= 0.85 ? "strong" : noteConfidence >= 0.6 ? "usable" : "limited"} statistical confidence.`),
    factor("duration", "Active gameplay duration", durationConfidence, 0.18, `${Math.round(input.activeDurationMs / 1000)} seconds of active gameplay ${durationConfidence >= 0.85 ? "gives strong sustained evidence" : "reduces confidence in long-form difficulty consistency"}.`),
    factor("coverage", "Active map coverage", activeCoverage, 0.18, `${Math.round(activeCoverage * 100)}% of the analyzed timeline contains active play rather than rests.`),
    factor("consistency", "Difficulty consistency", consistency, 0.18, p95 > 0 ? `Median and sustained strain remain ${consistency >= 0.8 ? "close to" : consistency >= 0.55 ? "reasonably close to" : "well below"} peak strain, measuring whether difficulty is representative instead of isolated spikes.` : "No stable strain profile was available."),
    factor("movement", "Movement signal", movementSignal, 0.10, `Direction and distance analysis provide ${movementSignal >= 0.8 ? "strong" : movementSignal >= 0.55 ? "moderate" : "weak"} movement evidence.`),
    factor("timing", "Timing signal", timingSignal, 0.09, `Relative NPS provides ${timingSignal >= 0.8 ? "strong" : timingSignal >= 0.55 ? "moderate" : "weak"} timing evidence.`),
    factor("variety", "Pattern coverage", patternVariety, 0.05, `${new Set(active.map((segment) => segment.pattern)).size} distinct active pattern classes were observed.`),
  ];
  const quality = factors.reduce((sum, item) => sum + (item.score / 5) * item.weight, 0);
  const rawScore = round(1 + 4 * clamp(quality));
  const rankedFloorApplied = input.sourceStatus === "ranked" && rawScore < 4;
  const score = input.sourceStatus === "ranked" ? round(Math.max(4, Math.min(5, rawScore))) : round(Math.min(5, rawScore));
  const strongest = [...factors].sort((a, b) => b.score - a.score).slice(0, 3);
  const weakest = [...factors].sort((a, b) => a.score - b.score).slice(0, 3);
  const strengths = strongest.filter((item) => item.score >= 3.5).map((item) => `${item.label}: ${item.score.toFixed(2)}/5.00`);
  const limitations = weakest.filter((item) => item.score < 4.25).map((item) => `${item.label}: ${item.score.toFixed(2)}/5.00 — ${item.reason}`);
  if (rankedFloorApplied) limitations.unshift(`Raw analysis suitability was ${rawScore.toFixed(2)}/5.00. Existing ranked maps use a 4.00 minimum display floor because they have already passed manual ranking validation; this does not change their ranked status.`);
  return { score, rawScore, factors, strengths, limitations, rankedFloorApplied };
}

export function mapRankability(input: RankabilityInput) {
  return mapRankabilityBreakdown(input).score;
}
