import type { MapPatternSegment } from "@/lib/map-difficulty";

export type RankabilityInput = {
  noteCount: number | null;
  activeDurationMs: number;
  patternSegments: MapPatternSegment[];
  directionScore: number;
  distanceScore: number;
  npsScore: number;
};

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
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

export function mapRankability(input: RankabilityInput) {
  const segments = input.patternSegments.filter((segment) => Number.isFinite(segment.startMs) && Number.isFinite(segment.endMs) && segment.endMs > segment.startMs);
  const active = segments.filter((segment) => segment.pattern !== "rest");
  const totalDuration = segments.length ? Math.max(...segments.map((segment) => segment.endMs)) : input.activeDurationMs;
  const activeCoverage = totalDuration > 0 ? clamp(input.activeDurationMs / totalDuration) : 0;
  const noteConfidence = clamp(((input.noteCount ?? 0) - 25) / 275);
  const durationConfidence = clamp((input.activeDurationMs - 15_000) / 75_000);
  const strains = active.map((segment) => Math.max(0, segment.averageStrain));
  const p75 = percentile(strains, 0.75);
  const p95 = percentile(strains, 0.95);
  const consistency = p95 > 0 ? clamp(p75 / p95 / 0.7) : 0;
  const signal = clamp((Math.max(0, input.directionScore) + Math.max(0, input.distanceScore) + Math.max(0, input.npsScore)) / 12);
  const quality = 0.30 * noteConfidence + 0.25 * durationConfidence + 0.20 * activeCoverage + 0.15 * consistency + 0.10 * signal;
  return Math.round((1 + 4 * clamp(quality)) * 100) / 100;
}
