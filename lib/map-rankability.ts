import type { MapDifficultyDetails, MapPatternSegment, MapSectionAnalysis } from "@/lib/map-difficulty";

export const RANKABILITY_ANALYZER_VERSION = 5;

export type RankabilityInput = {
  noteCount: number | null;
  activeDurationMs: number;
  patternSegments: MapPatternSegment[];
  topSections?: MapSectionAnalysis[];
  details?: MapDifficultyDetails | null;
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
  return weight ? total / weight : 0;
}

function weightedPercentile(items: MapPatternSegment[], value: (segment: MapPatternSegment) => number, p: number) {
  const rows = items
    .map((segment) => ({ value: value(segment), weight: Math.max(1, duration(segment)) }))
    .filter((row) => Number.isFinite(row.value))
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
  for (const amount of totals.values()) {
    const p = amount / total;
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
    if (gap > 4000) continue;

    const npsJump = Math.max(0, Math.abs(Math.min(32, current.averageNps) - Math.min(32, previous.averageNps)) - 11) / 21;
    const directionJump = Math.max(0, Math.abs(clamp(current.direction) - clamp(previous.direction)) - 0.42) / 0.58;
    const distanceJump = Math.max(0, Math.abs(clamp(current.distance) - clamp(previous.distance)) - 0.45) / 0.55;
    const strainJump = Math.max(0, Math.abs(current.averageStrain - previous.averageStrain) - 1.15) / 2.5;

    penalty += 0.34 * npsJump + 0.24 * directionJump + 0.2 * distanceJump + 0.22 * strainJump;
    compared += 1;
  }

  return compared ? clamp(1 - penalty / compared) : 1;
}

function motifQuality(items: MapPatternSegment[]) {
  if (items.length < 3) return 0.6;

  const signatures = items.map((item) => [
    item.pattern,
    Math.round(clamp(item.distance) * 4),
    Math.round(clamp(item.direction) * 4),
    Math.round(Math.min(30, Math.max(0, item.averageNps)) / 5),
  ].join(":"));

  const counts = new Map<string, number>();
  for (const signature of signatures) counts.set(signature, (counts.get(signature) ?? 0) + 1);

  const recurring = [...counts.values()].filter((count) => count >= 2).reduce((sum, count) => sum + count, 0);
  const recurrence = recurring / signatures.length;
  const unique = counts.size / signatures.length;

  return clamp(0.58 * recurrence + 0.42 * Math.min(1, unique * 1.8));
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
  if (score >= 4.7) return "Elite competitive mapping";
  if (score >= 4.3) return "Highly rankable";
  if (score >= 3.8) return "Strong rankability";
  if (score >= 3.2) return "Moderate rankability";
  if (score >= 2.4) return "Inconsistent competitive quality";
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
      summary: "No usable active pattern data was available for Rankability v5.",
      factors: [],
      strengths: [],
      limitations: ["No active pattern data was available."],
      rankedFloorApplied: false,
    };
  }

  const details = input.details ?? null;
  const activeMs = active.reduce((sum, segment) => sum + duration(segment), 0);
  const spanStart = Math.min(...segments.map((segment) => segment.startMs));
  const spanEnd = Math.max(...segments.map((segment) => segment.endMs));
  const spanMs = Math.max(1, spanEnd - spanStart);
  const duty = clamp(activeMs / spanMs);

  const avgDistance = weightedAverage(active, (segment) => clamp(segment.distance));
  const avgDirection = weightedAverage(active, (segment) => clamp(segment.direction));
  const avgJumpness = weightedAverage(active, (segment) => clamp(segment.jumpness));
  const avgStrain = weightedAverage(active, (segment) => Math.max(0, segment.averageStrain));
  const p80Strain = weightedPercentile(active, (segment) => Math.max(0, segment.averageStrain), 0.8);
  const p95Strain = weightedPercentile(active, (segment) => Math.max(0, segment.peakStrain), 0.95);
  const avgCheese = weightedAverage(active, (segment) => clamp(segment.cheeseRatio ?? 0));
  const entropy = patternEntropy(active);
  const patternKinds = new Set(active.map((segment) => segment.pattern)).size;
  const flow = transitionQuality(active);
  const motifs = motifQuality(active);

  const movementQuality = clamp(
    0.42 * clamp((details?.movementPressure ?? avgDistance) / 0.72) +
    0.33 * clamp((details?.directionPressure ?? avgDirection) / 0.62) +
    0.25 * clamp(avgJumpness / 0.72),
  );

  const sustainedQuality = details
    ? clamp(
      0.4 * clamp(details.sustainedDifficulty / Math.max(0.15, details.peakDifficulty)) +
      0.25 * clamp(details.coreDifficulty / Math.max(0.15, details.sustainedDifficulty)) +
      0.2 * details.difficultyConsistency +
      0.15 * clamp(1 - details.coverage.easy),
    )
    : clamp(
      0.58 * clamp(avgStrain / Math.max(0.1, p80Strain)) +
      0.42 * clamp(p80Strain / Math.max(0.1, p95Strain)),
    );

  const varietyQuality = clamp(
    0.5 * entropy +
    0.2 * clamp((patternKinds - 1) / 3) +
    0.3 * motifs,
  );

  const pacingQuality = details
    ? clamp(
      0.34 * clamp(details.timingPressure / 2.8) +
      0.28 * clamp(details.windows.medium / Math.max(0.1, details.windows.micro)) +
      0.22 * clamp(details.windows.long / Math.max(0.1, details.windows.medium)) +
      0.16 * (1 - clamp(details.recoveryRatio / 0.8)),
    )
    : clamp(weightedAverage(active, (segment) => Math.min(30, segment.averageNps)) / 16);

  const antiCheese = clamp(1 - Math.max(avgCheese, details?.cheeseRatio ?? 0));
  const consistency = details?.difficultyConsistency ?? clamp(
    1 - Math.abs(p95Strain - p80Strain) / Math.max(0.4, p95Strain * 1.6),
  );

  const confidence = clamp(
    0.42 * clamp(activeMs / 90000) +
    0.28 * clamp(Math.max(0, input.noteCount ?? 0) / 450) +
    0.18 * clamp(active.length / 22) +
    0.12 * duty,
  );

  const factors = [
    factor(
      "movement",
      "Movement quality",
      movementQuality,
      0.2,
      `Uses raw spacing and three-note direction mechanics across the full map. Average section movement is ${(avgDistance * 100).toFixed(0)}% spacing and ${(avgDirection * 100).toFixed(0)}% direction pressure.`,
    ),
    factor(
      "sustain",
      "Sustained competitive challenge",
      sustainedQuality,
      0.18,
      details
        ? `Whole-map core ${details.coreDifficulty.toFixed(2)}, sustained ${details.sustainedDifficulty.toFixed(2)}, and peak ${details.peakDifficulty.toFixed(2)} difficulty are compared so isolated spikes cannot carry rankability.`
        : "Compares average, sustained, and peak section strain so isolated spikes do not carry the score.",
    ),
    factor(
      "variety",
      "Structured pattern design",
      varietyQuality,
      0.16,
      `${patternKinds} pattern families, ${(entropy * 100).toFixed(0)}% duration-weighted variety, and recurring motifs are used to distinguish purposeful pattern design from random changes.`,
    ),
    factor(
      "pacing",
      "Rhythmic pacing",
      pacingQuality,
      0.13,
      details
        ? `Micro/short/medium/long pressure is ${details.windows.micro.toFixed(2)} / ${details.windows.short.toFixed(2)} / ${details.windows.medium.toFixed(2)} / ${details.windows.long.toFixed(2)}.`
        : "Uses local note density and section flow to reward readable intensity changes.",
    ),
    factor(
      "flow",
      "Pattern transitions",
      flow,
      0.11,
      `${Math.round(flow * 100)}% transition coherence after allowing normal changes in speed, spacing, direction, and pattern family.`,
    ),
    factor(
      "integrity",
      "Anti-cheese integrity",
      antiCheese,
      0.1,
      `${Math.round(antiCheese * 100)}% integrity after discounting very fast low-movement or low-direction sections that inflate density without equivalent mechanical demand.`,
    ),
    factor(
      "consistency",
      "Difficulty readability",
      consistency,
      0.07,
      `${Math.round(consistency * 100)}% whole-map difficulty consistency. This does not require flat difficulty; it penalizes unexplained one-off spikes more than intentional difficulty arcs.`,
    ),
    factor(
      "sample",
      "Analysis confidence",
      confidence,
      0.05,
      `${Math.round(activeMs / 1000)}s active, ${active.length} pattern segments, ${Math.max(0, input.noteCount ?? 0).toLocaleString()} notes, and ${Math.round(duty * 100)}% active duty support the result.`,
    ),
  ];

  const quality = clamp(
    factors.reduce((sum, item) => sum + ((item.score - 1) / 4) * item.weight, 0),
  );
  const rawScore = round(1 + 4 * quality);
  const score = rawScore;

  const sorted = [...factors].sort((a, b) => b.score - a.score);
  const strengths = sorted
    .slice(0, 4)
    .filter((item) => item.score >= 4)
    .map((item) => `${item.label}: ${item.score.toFixed(2)}/5.00 — ${item.reason}`);
  const limitations = [...sorted]
    .reverse()
    .slice(0, 3)
    .filter((item) => item.score < 4)
    .map((item) => `${item.label}: ${item.score.toFixed(2)}/5.00 — ${item.reason}`);

  const sourceLabel = input.sourceStatus ? `${input.sourceStatus} map` : "map";
  const summary = `${verdict(score)}. Rankability v${RANKABILITY_ANALYZER_VERSION} scores this ${sourceLabel} at ${score.toFixed(2)}/5.00 using the same raw-map mechanics as Difficulty v5, including whole-map pattern structure, sustained challenge, pacing, transitions, and anti-cheese integrity.`;

  return {
    version: RANKABILITY_ANALYZER_VERSION,
    score,
    rawScore,
    confidence: round(confidence),
    verdict: verdict(score),
    summary,
    factors,
    strengths,
    limitations,
    rankedFloorApplied: false,
  };
}

export function mapRankability(input: RankabilityInput) {
  return mapRankabilityBreakdown(input).score;
}
