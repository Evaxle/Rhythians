import type { MapPatternSegment } from "@/lib/map-difficulty";

export const RANKABILITY_ANALYZER_VERSION = 4;

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
  version: number;
  score: number;
  rawScore: number;
  confidence: number;
  verdict: string;
  summary: string;
  factors: RankabilityFactor[];
  strengths: string[];
  limitations: string[];
  rankedFloorApplied: boolean;
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * 100) / 100;

function duration(segment: MapPatternSegment) {
  return Math.max(0, segment.endMs - segment.startMs);
}

function weightedAverage(items: MapPatternSegment[], value: (segment: MapPatternSegment) => number) {
  let total = 0;
  let weight = 0;
  for (const item of items) {
    const w = Math.max(1, duration(item));
    const v = value(item);
    if (!Number.isFinite(v)) continue;
    total += v * w;
    weight += w;
  }
  return weight > 0 ? total / weight : 0;
}

function weightedDeviation(items: MapPatternSegment[], value: (segment: MapPatternSegment) => number) {
  const mean = weightedAverage(items, value);
  let total = 0;
  let weight = 0;
  for (const item of items) {
    const w = Math.max(1, duration(item));
    const v = value(item);
    if (!Number.isFinite(v)) continue;
    total += (v - mean) ** 2 * w;
    weight += w;
  }
  return weight > 0 ? Math.sqrt(total / weight) : 0;
}

function weightedPercentile(items: MapPatternSegment[], value: (segment: MapPatternSegment) => number, p: number) {
  const rows = items
    .map((segment) => ({ value: value(segment), weight: Math.max(1, duration(segment)) }))
    .filter((row) => Number.isFinite(row.value) && row.weight > 0)
    .sort((a, b) => a.value - b.value);
  if (!rows.length) return 0;
  const totalWeight = rows.reduce((sum, row) => sum + row.weight, 0);
  const target = clamp(p) * totalWeight;
  let running = 0;
  for (const row of rows) {
    running += row.weight;
    if (running >= target) return row.value;
  }
  return rows[rows.length - 1].value;
}

function patternEntropy(items: MapPatternSegment[]) {
  const totals = new Map<string, number>();
  let total = 0;
  for (const item of items) {
    const w = Math.max(1, duration(item));
    totals.set(item.pattern, (totals.get(item.pattern) ?? 0) + w);
    total += w;
  }
  if (!total || totals.size <= 1) return 0;
  let entropy = 0;
  for (const weight of totals.values()) {
    const p = weight / total;
    entropy -= p * Math.log(Math.max(p, 1e-9));
  }
  return clamp(entropy / Math.log(5));
}

function transitionQuality(items: MapPatternSegment[]) {
  if (items.length < 2) return 1;
  let penalty = 0;
  let compared = 0;
  for (let i = 1; i < items.length; i += 1) {
    const previous = items[i - 1];
    const current = items[i];
    const gap = current.startMs - previous.endMs;
    if (gap > 3000) continue;
    const npsJump = Math.max(0, Math.abs(Math.min(30, current.averageNps) - Math.min(30, previous.averageNps)) - 10) / 20;
    const directionJump = Math.max(0, Math.abs(clamp(current.direction) - clamp(previous.direction)) - 0.35) / 0.65;
    const distanceJump = Math.max(0, Math.abs(clamp(current.distance) - clamp(previous.distance)) - 0.4) / 0.6;
    penalty += 0.45 * npsJump + 0.3 * directionJump + 0.25 * distanceJump;
    compared += 1;
  }
  return compared ? clamp(1 - penalty / compared) : 1;
}

function antiCheeseQuality(items: MapPatternSegment[]) {
  let suspicious = 0;
  let total = 0;
  for (const item of items) {
    const w = Math.max(1, duration(item));
    total += w;
    const fast = Math.min(30, Math.max(0, item.averageNps));
    const lowMovement = clamp((0.24 - clamp(item.distance)) / 0.24);
    const lowDirection = clamp((0.18 - clamp(item.direction)) / 0.18);
    const speedPressure = clamp((fast - 10) / 12);
    suspicious += w * speedPressure * lowMovement * (0.55 + 0.45 * lowDirection);
  }
  return total ? clamp(1 - 1.35 * suspicious / total) : 0;
}

function factor(key: string, label: string, quality: number, weight: number, reason: string): RankabilityFactor {
  const safe = clamp(quality);
  return {
    key,
    label,
    score: round(1 + 4 * safe),
    weight,
    contribution: round(safe * weight * 4),
    reason,
  };
}

function verdict(score: number) {
  if (score >= 4.65) return "Elite competitive mapping";
  if (score >= 4.25) return "Highly rankable";
  if (score >= 3.75) return "Strong rankability";
  if (score >= 3.1) return "Moderate rankability";
  if (score >= 2.3) return "Inconsistent competitive quality";
  return "Weak rankability";
}

export function mapRankabilityBreakdown(input: RankabilityInput): RankabilityBreakdown {
  const segments = input.patternSegments
    .filter((segment) => Number.isFinite(segment.startMs) && Number.isFinite(segment.endMs) && segment.endMs > segment.startMs)
    .sort((a, b) => a.startMs - b.startMs);
  const active = segments.filter((segment) => segment.pattern !== "rest");

  if (!active.length) {
    return {
      version: RANKABILITY_ANALYZER_VERSION,
      score: 1,
      rawScore: 1,
      confidence: 0,
      verdict: "Weak rankability",
      summary: "No usable active pattern sections were available for Rankability v4.",
      factors: [],
      strengths: [],
      limitations: ["No active pattern data was available."],
      rankedFloorApplied: false,
    };
  }

  const activeMs = active.reduce((sum, segment) => sum + duration(segment), 0);
  const spanStart = Math.min(...segments.map((segment) => segment.startMs));
  const spanEnd = Math.max(...segments.map((segment) => segment.endMs));
  const spanMs = Math.max(1, spanEnd - spanStart);
  const duty = clamp(activeMs / spanMs);

  const avgStrain = weightedAverage(active, (segment) => Math.max(0, segment.averageStrain));
  const p50Strain = weightedPercentile(active, (segment) => Math.max(0, segment.averageStrain), 0.5);
  const p80Strain = weightedPercentile(active, (segment) => Math.max(0, segment.averageStrain), 0.8);
  const p95Strain = weightedPercentile(active, (segment) => Math.max(0, segment.averageStrain), 0.95);
  const avgNps = weightedAverage(active, (segment) => Math.min(30, Math.max(0, segment.averageNps)));
  const npsDeviation = weightedDeviation(active, (segment) => Math.min(30, Math.max(0, segment.averageNps)));
  const avgDirection = weightedAverage(active, (segment) => clamp(segment.direction));
  const avgDistance = weightedAverage(active, (segment) => clamp(segment.distance));
  const avgJumpness = weightedAverage(active, (segment) => clamp(segment.jumpness));
  const kinds = new Set(active.map((segment) => segment.pattern)).size;
  const entropy = patternEntropy(active);
  const flow = transitionQuality(active);
  const integrity = antiCheeseQuality(active);

  const movementQuality = clamp(
    0.45 * clamp(avgDistance / 0.78) +
    0.35 * clamp(avgDirection / 0.52) +
    0.20 * clamp(avgJumpness / 0.75),
  );

  const sustainedChallenge = p95Strain > 0
    ? clamp(
      0.50 * clamp(p80Strain / p95Strain) +
      0.30 * clamp(p50Strain / Math.max(0.01, p80Strain)) +
      0.20 * clamp(avgStrain / Math.max(0.01, p80Strain)),
    )
    : 0;

  const structuredVariety = clamp(
    0.70 * entropy +
    0.30 * clamp((kinds - 1) / 3),
  );

  const pacingCraft = clamp(
    0.55 * clamp(avgNps / 14) +
    0.45 * clamp(npsDeviation / 8),
  );

  const sampleConfidence = clamp(
    0.45 * clamp(activeMs / 90000) +
    0.30 * clamp(Math.max(0, input.noteCount ?? 0) / 500) +
    0.15 * clamp(active.length / 24) +
    0.10 * duty,
  );

  const factors = [
    factor("movement", "Movement quality", movementQuality, 0.23, `Average movement is ${(avgDistance * 100).toFixed(0)}% spacing, ${(avgDirection * 100).toFixed(0)}% direction change, and ${(avgJumpness * 100).toFixed(0)}% jump character. V4 rewards deliberate movement and skill expression instead of requiring every section to look the same.`),
    factor("sustain", "Sustained challenge", sustainedChallenge, 0.18, `Strain distribution is ${p50Strain.toFixed(2)} median / ${p80Strain.toFixed(2)} sustained / ${p95Strain.toFixed(2)} peak. Peaks score well when the surrounding map supports them instead of being isolated difficulty spikes.`),
    factor("variety", "Structured pattern variety", structuredVariety, 0.16, `${kinds} pattern types are represented with ${(entropy * 100).toFixed(0)}% duration-weighted pattern entropy. Purposeful jump/stream/mixed variety is rewarded; random one-off changes are handled by the transition factor instead.`),
    factor("pacing", "Rhythmic pacing", pacingCraft, 0.14, `Active sections average ${avgNps.toFixed(1)} NPS with ${npsDeviation.toFixed(1)} NPS dynamic spread. V4 rewards readable intensity arcs and meaningful density changes rather than simply rewarding flat NPS.`),
    factor("flow", "Pattern transitions", flow, 0.12, `${(flow * 100).toFixed(0)}% transition coherence after allowing normal pattern and tempo changes. Only unusually abrupt speed/movement discontinuities are penalized.`),
    factor("integrity", "Anti-cheese integrity", integrity, 0.10, `${(integrity * 100).toFixed(0)}% anti-cheese integrity. Very fast sections with almost no spacing or directional demand are discounted so raw note density cannot carry rankability by itself.`),
    factor("sample", "Analysis confidence", sampleConfidence, 0.07, `${Math.round(activeMs / 1000)}s of active mapping, ${active.length} active segments, ${Math.max(0, input.noteCount ?? 0).toLocaleString()} notes, and ${(duty * 100).toFixed(0)}% active duty provide the evidence behind this score.`),
  ];

  const quality = clamp(factors.reduce((sum, item) => sum + ((item.score - 1) / 4) * item.weight, 0));
  const rawScore = round(1 + 4 * quality);
  const score = rawScore;
  const sorted = [...factors].sort((a, b) => b.score - a.score);
  const strongest = sorted.slice(0, 4);
  const weakest = [...sorted].reverse().slice(0, 3);
  const strengths = strongest.filter((item) => item.score >= 4).map((item) => `${item.label}: ${item.score.toFixed(2)}/5.00 — ${item.reason}`);
  const limitations = weakest.filter((item) => item.score < 4).map((item) => `${item.label}: ${item.score.toFixed(2)}/5.00 — ${item.reason}`);
  const sourceLabel = input.sourceStatus ? `${input.sourceStatus} map` : "map";
  const summary = `${verdict(score)}. Rankability v${RANKABILITY_ANALYZER_VERSION} scores this ${sourceLabel} at ${score.toFixed(2)}/5.00 from movement quality, sustained challenge, structured variety, pacing, transitions, anti-cheese integrity, and analysis confidence.`;

  return { version: RANKABILITY_ANALYZER_VERSION, score, rawScore, confidence: round(sampleConfidence), verdict: verdict(score), summary, factors, strengths, limitations, rankedFloorApplied: false };
}

export function mapRankability(input: RankabilityInput) {
  return mapRankabilityBreakdown(input).score;
}
