import type { MapPatternSegment } from "@/lib/map-difficulty";

export const CHALLENGE_FIT_CATEGORIES = ["challenge", "jumps", "stream", "tech", "off_grid", "vibro"] as const;
export type ChallengeFitCategory = typeof CHALLENGE_FIT_CATEGORIES[number];

export const CHALLENGE_FIT_LABELS: Record<ChallengeFitCategory, string> = {
  challenge: "Challenge", jumps: "Jumps", stream: "Stream", tech: "Tech", off_grid: "Off Grid", vibro: "Vibro",
};
export type ChallengeCategoryFit = { category: ChallengeFitCategory; label: string; score: number; suggestedLevel: number; reason: string; metrics: Array<{ label: string; value: string }> };
export type ChallengeFitInput = { rating: number; directionScore: number; distanceScore: number; npsScore: number; staminaIndex: number; peakJumpNps: number; peakStreamNps: number; peakJumpStrain: number; peakStreamStrain: number; jumpRatio: number; patternSegments: MapPatternSegment[] };
const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const round = (v: number) => Math.round(v * 100) / 100;
const fit = (quality: number) => round(1 + 4 * clamp(quality));
const level = (v: number) => Math.max(1, Math.min(10, Math.round(v)));
function weightedAverage(values: Array<{ value: number; weight: number }>) { const weight = values.reduce((sum, item) => sum + item.weight, 0); return weight ? values.reduce((sum, item) => sum + item.value * item.weight, 0) / weight : 0; }
function segmentDuration(segment: MapPatternSegment) { return Math.max(0, segment.endMs - segment.startMs); }
function normalizedVariance(values: number[], scale: number) { if (values.length < 2) return 0; const mean = values.reduce((a, b) => a + b, 0) / values.length; const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length; return clamp(Math.sqrt(variance) / Math.max(scale, Math.abs(mean), 0.01)); }

export function challengeCategoryFits(input: ChallengeFitInput): ChallengeCategoryFit[] {
  const active = input.patternSegments.filter((s) => s.pattern !== "rest" && segmentDuration(s) > 0);
  const total = active.reduce((sum, s) => sum + segmentDuration(s), 0) || 1;
  const share = (patterns: string[]) => active.filter((s) => patterns.includes(s.pattern)).reduce((sum, s) => sum + segmentDuration(s), 0) / total;
  const jumpShare = clamp(0.58 * clamp(input.jumpRatio) + 0.42 * share(["jump", "jump-lean"]));
  const streamShare = clamp(0.58 * (1 - clamp(input.jumpRatio)) + 0.42 * share(["stream", "stream-lean"]));
  const mixedShare = share(["mixed"]);
  const npsValues = active.map((s) => Math.min(22, Math.max(0, s.averageNps)));
  const directionValues = active.map((s) => clamp(s.direction));
  const distanceValues = active.map((s) => clamp(s.distance));
  const npsMean = weightedAverage(active.map((s) => ({ value: Math.min(22, Math.max(0, s.averageNps)), weight: segmentDuration(s) })));
  const directionMean = weightedAverage(active.map((s) => ({ value: clamp(s.direction), weight: segmentDuration(s) })));
  const distanceMean = weightedAverage(active.map((s) => ({ value: clamp(s.distance), weight: segmentDuration(s) })));
  const npsVariation = normalizedVariance(npsValues, 7), directionVariation = normalizedVariance(directionValues, 0.35);
  const flow = active.length < 2 ? 0.5 : 1 - clamp(active.slice(1).reduce((sum, s, i) => { const prev = active[i]; return sum + 0.42 * clamp(Math.abs(Math.min(22, s.averageNps) - Math.min(22, prev.averageNps)) / 10) + 0.33 * Math.abs(clamp(s.direction) - clamp(prev.direction)) + 0.25 * Math.abs(clamp(s.distance) - clamp(prev.distance)); }, 0) / (active.length - 1));
  const timingIrregularity = clamp(0.65 * npsVariation + 0.35 * (1 - flow));
  const movementComplexity = clamp(0.55 * input.directionScore / 10 + 0.45 * input.distanceScore / 10);
  const speed = clamp(Math.max(input.npsScore / 10, npsMean / 13));
  const jumpSpeed = clamp(Math.min(input.peakJumpNps, 24) / 16), streamSpeed = clamp(Math.min(input.peakStreamNps, 24) / 16);
  const jumpQuality = clamp(0.34 * jumpShare + 0.22 * distanceMean + 0.18 * directionMean + 0.16 * flow + 0.10 * clamp(input.peakJumpStrain / 5));
  const streamQuality = clamp(0.36 * streamShare + 0.22 * (1 - npsVariation) + 0.18 * clamp(input.staminaIndex) + 0.14 * streamSpeed + 0.10 * flow);
  const techAmount = clamp(0.42 * input.directionScore / 10 + 0.23 * directionVariation + 0.20 * speed + 0.15 * mixedShare);
  const techQuality = clamp(0.72 * techAmount + 0.28 * flow);
  const offGridAmount = clamp(0.64 * timingIrregularity + 0.18 * mixedShare + 0.18 * directionVariation);
  const offGridQuality = clamp(0.78 * offGridAmount + 0.22 * Math.max(0.35, flow));
  const vibroAmount = clamp(0.58 * Math.max(jumpSpeed, speed) + 0.25 * jumpShare + 0.17 * directionMean);
  const vibroQuality = clamp(0.76 * vibroAmount + 0.24 * flow);
  const balanceParts = [jumpShare, streamShare, clamp(mixedShare * 2), movementComplexity, speed];
  const meanBalance = balanceParts.reduce((a, b) => a + b, 0) / balanceParts.length;
  const balanceSpread = Math.sqrt(balanceParts.reduce((sum, v) => sum + (v - meanBalance) ** 2, 0) / balanceParts.length);
  const challengeQuality = clamp(0.55 * (1 - clamp(balanceSpread / 0.42)) + 0.25 * flow + 0.20 * clamp(input.staminaIndex + 0.25));
  const ratingLevel = level(1 + ((Math.max(2.4, input.rating) - 2.4) / 0.62));
  const jumpLevel = level(0.45 * ratingLevel + 5.5 * (0.34 * jumpSpeed + 0.33 * distanceMean + 0.33 * directionMean));
  const streamLevel = level(0.48 * ratingLevel + 5.2 * (0.45 * streamSpeed + 0.30 * clamp(input.staminaIndex) + 0.25 * speed));
  const techLevel = level(0.35 * ratingLevel + 6.5 * (0.54 * input.directionScore / 10 + 0.26 * directionVariation + 0.20 * speed));
  const offGridLevel = level(0.46 * ratingLevel + 5.4 * (0.66 * timingIrregularity + 0.34 * speed));
  const vibroLevel = level(0.28 * ratingLevel + 7.2 * (0.68 * Math.max(jumpSpeed, speed) + 0.32 * Math.max(directionMean, directionVariation)));
  const common = [{ label: "NPS", value: npsMean.toFixed(2) }, { label: "Direction", value: input.directionScore.toFixed(2) }, { label: "Distance", value: input.distanceScore.toFixed(2) }];
  return [
    { category: "challenge", label: "Challenge", score: fit(challengeQuality), suggestedLevel: ratingLevel, reason: "Rewards a hard but representative mix of jumps, streams, mixed movement, timing and sustained strain without one element dominating the map.", metrics: [{ label: "Balance", value: `${Math.round((1 - clamp(balanceSpread / 0.42)) * 100)}%` }, ...common] },
    { category: "jumps", label: "Jumps", score: fit(jumpQuality), suggestedLevel: jumpLevel, reason: "Measures how strongly jump patterns are represented and whether spacing and direction changes flow intentionally instead of appearing as disconnected random spikes.", metrics: [{ label: "Jump share", value: `${Math.round(jumpShare * 100)}%` }, { label: "Flow", value: `${Math.round(flow * 100)}%` }, ...common] },
    { category: "stream", label: "Stream", score: fit(streamQuality), suggestedLevel: streamLevel, reason: "Measures sustained stream content, pacing consistency and stamina. Stable dense movement scores better than isolated bursts.", metrics: [{ label: "Stream share", value: `${Math.round(streamShare * 100)}%` }, { label: "Pacing", value: `${Math.round((1 - npsVariation) * 100)}%` }, ...common] },
    { category: "tech", label: "Tech", score: fit(techQuality), suggestedLevel: techLevel, reason: "Measures coherent unconventional movement. The suggested level heavily weights speed plus complex and changing directions.", metrics: [{ label: "Direction variation", value: `${Math.round(directionVariation * 100)}%` }, { label: "Flow", value: `${Math.round(flow * 100)}%` }, ...common] },
    { category: "off_grid", label: "Off Grid", score: fit(offGridQuality), suggestedLevel: offGridLevel, reason: "Uses local NPS/timing irregularity as a conservative off-grid proxy. Exact beat-grid deviation requires BPM/grid metadata that the analyzer does not retain yet.", metrics: [{ label: "Timing irregularity", value: `${Math.round(timingIrregularity * 100)}%` }, ...common] },
    { category: "vibro", label: "Vibro", score: fit(vibroQuality), suggestedLevel: vibroLevel, reason: "Measures fast repeated/jump-like density and directional complexity. Speed is the largest level factor; direction complexity raises the level for less comfortable angles.", metrics: [{ label: "Speed signal", value: `${Math.round(Math.max(jumpSpeed, speed) * 100)}%` }, { label: "Direction complexity", value: `${Math.round(Math.max(directionMean, directionVariation) * 100)}%` }, ...common] },
  ];
}
