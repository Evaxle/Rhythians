import type { MapPatternSegment } from "@/lib/map-difficulty";

export const CHALLENGE_FIT_CATEGORIES = ["challenge", "jumps", "stream", "tech", "off_grid", "vibro"] as const;
export type ChallengeFitCategory = typeof CHALLENGE_FIT_CATEGORIES[number];

export const CHALLENGE_FIT_LABELS: Record<ChallengeFitCategory, string> = {
  challenge: "Challenge",
  jumps: "Jumps",
  stream: "Stream",
  tech: "Tech",
  off_grid: "Off Grid",
  vibro: "Vibro",
};

export type ChallengeCategoryFit = {
  category: ChallengeFitCategory;
  label: string;
  score: number;
  suggestedLevel: number;
  reason: string;
  metrics: Array<{ label: string; value: string }>;
};

export type ChallengeFitInput = {
  rating: number;
  directionScore: number;
  distanceScore: number;
  npsScore: number;
  staminaIndex: number;
  peakJumpNps: number;
  peakStreamNps: number;
  peakJumpStrain: number;
  peakStreamStrain: number;
  jumpRatio: number;
  patternSegments: MapPatternSegment[];
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * 100) / 100;
const fit = (score: number) => round(1 + 4 * clamp(score / 100));
const level = (difficulty: number) => Math.max(1, Math.min(10, Math.round(1 + clamp(difficulty) * 9)));

function weightedAverage(values: Array<{ value: number; weight: number }>) {
  const weight = values.reduce((sum, item) => sum + item.weight, 0);
  return weight ? values.reduce((sum, item) => sum + item.value * item.weight, 0) / weight : 0;
}

function segmentDuration(segment: MapPatternSegment) {
  return Math.max(0, segment.endMs - segment.startMs);
}

function normalizedVariance(values: number[], scale: number) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return clamp(Math.sqrt(variance) / Math.max(scale, Math.abs(mean), 0.01));
}

export function challengeCategoryFits(input: ChallengeFitInput): ChallengeCategoryFit[] {
  const active = input.patternSegments.filter((segment) => segment.pattern !== "rest" && segmentDuration(segment) > 0);
  const totalDuration = active.reduce((sum, segment) => sum + segmentDuration(segment), 0) || 1;
  const durationShare = (predicate: (segment: MapPatternSegment) => boolean) =>
    active.filter(predicate).reduce((sum, segment) => sum + segmentDuration(segment), 0) / totalDuration;

  const vibroShare = durationShare((segment) => segment.averageNps >= 16 && segment.jumpness >= 0.72);
  const streamShare = durationShare(
    (segment) => segment.averageNps >= 12 && segment.jumpness >= 0.45 && segment.jumpness <= 0.79 && segment.direction <= 0.52,
  );
  const jumpShare = durationShare((segment) => segment.jumpness >= 0.72 && segment.averageNps < 16);
  const techShare = durationShare((segment) => segment.direction >= 0.55);
  const mixedShare = durationShare((segment) => segment.pattern === "mixed");

  const npsValues = active.map((segment) => Math.max(0, segment.averageNps));
  const directionValues = active.map((segment) => clamp(segment.direction));
  const distanceValues = active.map((segment) => clamp(segment.distance));
  const npsMean = weightedAverage(active.map((segment) => ({ value: Math.max(0, segment.averageNps), weight: segmentDuration(segment) })));
  const directionMean = weightedAverage(active.map((segment) => ({ value: clamp(segment.direction), weight: segmentDuration(segment) })));
  const distanceMean = weightedAverage(active.map((segment) => ({ value: clamp(segment.distance), weight: segmentDuration(segment) })));
  const npsVariation = normalizedVariance(npsValues, 10);
  const directionVariation = normalizedVariance(directionValues, 0.25);

  const flow = active.length < 2
    ? 0.5
    : 1 - clamp(
        active.slice(1).reduce((sum, segment, index) => {
          const previous = active[index];
          return sum
            + 0.42 * clamp(Math.abs(segment.averageNps - previous.averageNps) / 10)
            + 0.33 * Math.abs(clamp(segment.direction) - clamp(previous.direction))
            + 0.25 * Math.abs(clamp(segment.distance) - clamp(previous.distance));
        }, 0) / (active.length - 1),
      );

  const vibroFitRaw = Math.min(
    100,
    vibroShare * 75 + Math.min(input.peakJumpNps / 30, 1) * 15 + clamp(input.jumpRatio) * 10,
  );
  const streamFitRaw = Math.min(
    100,
    streamShare * 65
      + Math.min(input.peakStreamNps / 16, 1) * 15
      + Math.min(npsMean / 22, 1) * 10
      + (1 - Math.min(Math.abs(clamp(input.jumpRatio) - 0.6) / 0.6, 1)) * 10,
  );

  const jumpBase = Math.min(
    100,
    jumpShare * 55
      + Math.min(distanceMean, 1) * 20
      + clamp(input.jumpRatio) * 15
      + (1 - Math.min(input.peakJumpNps / 24, 1)) * 10,
  );
  const jumpVibroPenalty = 1 - Math.min(Math.max((input.peakJumpNps - 16) / 20, 0), 0.65);
  const jumpsFitRaw = jumpBase * jumpVibroPenalty;

  const techBase = Math.min(
    100,
    techShare * 45
      + Math.min(input.directionScore / 10, 1) * 30
      + Math.min(directionVariation, 1) * 15
      + Math.min(npsMean / 18, 1) * 10,
  );
  const techFitRaw = techBase
    * (1 - Math.min(vibroShare * 1.5, 0.72))
    * (1 - Math.min(streamShare * 0.7, 0.35));

  const offGridBase = Math.min(
    100,
    Math.min(npsVariation, 1) * 35
      + Math.min(directionVariation, 1) * 30
      + mixedShare * 20
      + Math.min(input.directionScore / 10, 1) * 15,
  );
  const offGridFitRaw = offGridBase
    * (1 - Math.min(vibroShare, 0.45))
    * (1 - Math.min(streamShare * 0.5, 0.25));

  const vibroDifficulty = clamp(
    Math.min(input.peakJumpNps / 36, 1) * 0.38
      + Math.min(npsMean / 28, 1) * 0.22
      + Math.min(input.peakJumpStrain / 6, 1) * 0.2
      + Math.min(input.directionScore / 10, 1) * 0.1
      + Math.min(input.rating / 8, 1) * 0.1,
  );
  const streamDifficulty = clamp(
    Math.min(input.peakStreamNps / 18, 1) * 0.3
      + Math.min(npsMean / 26, 1) * 0.25
      + Math.min(input.peakStreamStrain / 4, 1) * 0.15
      + Math.min(input.staminaIndex / 0.35, 1) * 0.15
      + Math.min(input.rating / 8, 1) * 0.15,
  );
  const jumpsDifficulty = clamp(
    Math.min(input.peakJumpStrain / 6, 1) * 0.25
      + Math.min(distanceMean, 1) * 0.25
      + Math.min(input.directionScore / 10, 1) * 0.15
      + Math.min(input.peakJumpNps / 24, 1) * 0.2
      + Math.min(input.rating / 8, 1) * 0.15,
  );
  const techDifficulty = clamp(
    Math.min(input.directionScore / 10, 1) * 0.4
      + Math.min(directionVariation, 1) * 0.2
      + Math.min(npsMean / 22, 1) * 0.2
      + Math.min(input.rating / 8, 1) * 0.2,
  );
  const offGridDifficulty = clamp(
    Math.min(npsVariation, 1) * 0.3
      + Math.min(directionVariation, 1) * 0.3
      + mixedShare * 0.2
      + Math.min(input.directionScore / 10, 1) * 0.2,
  );

  const balanceParts = [clamp(input.jumpRatio), 1 - clamp(input.jumpRatio), clamp(mixedShare * 2), clamp(input.directionScore / 10), clamp(input.npsScore / 10)];
  const meanBalance = balanceParts.reduce((a, b) => a + b, 0) / balanceParts.length;
  const balanceSpread = Math.sqrt(balanceParts.reduce((sum, value) => sum + (value - meanBalance) ** 2, 0) / balanceParts.length);
  const challengeQuality = clamp(0.55 * (1 - clamp(balanceSpread / 0.42)) + 0.25 * flow + 0.2 * clamp(input.staminaIndex + 0.25));
  const ratingLevel = Math.max(1, Math.min(10, Math.round(1 + ((Math.max(2.4, input.rating) - 2.4) / 0.62))));

  const common = [
    { label: "NPS", value: npsMean.toFixed(2) },
    { label: "Direction", value: input.directionScore.toFixed(2) },
    { label: "Distance", value: input.distanceScore.toFixed(2) },
  ];

  return [
    {
      category: "challenge",
      label: "Challenge",
      score: fit(challengeQuality * 100),
      suggestedLevel: ratingLevel,
      reason: "Rewards a hard but representative mix of jumps, streams, mixed movement, timing and sustained strain without one element dominating the map.",
      metrics: [{ label: "Balance", value: `${Math.round((1 - clamp(balanceSpread / 0.42)) * 100)}%` }, ...common],
    },
    {
      category: "jumps",
      label: "Jumps",
      score: fit(jumpsFitRaw),
      suggestedLevel: level(jumpsDifficulty),
      reason: "Rewards deliberate spaced jumps and jump flow. Very fast repeated jumps are penalized here because they belong in Vibro instead of generic Jumps.",
      metrics: [{ label: "Jump-pattern share", value: `${Math.round(jumpShare * 100)}%` }, { label: "Peak jump NPS", value: input.peakJumpNps.toFixed(2) }, ...common],
    },
    {
      category: "stream",
      label: "Stream",
      score: fit(streamFitRaw),
      suggestedLevel: level(streamDifficulty),
      reason: "Rewards sustained high-NPS movement with moderate jumpness and stable direction, so dense stream-heavy maps are classified as Stream even when the analyzer also sees jump-like movement.",
      metrics: [{ label: "Stream signal", value: `${Math.round(streamShare * 100)}%` }, { label: "Peak stream NPS", value: input.peakStreamNps.toFixed(2) }, ...common],
    },
    {
      category: "tech",
      label: "Tech",
      score: fit(techFitRaw),
      suggestedLevel: level(techDifficulty),
      reason: "Rewards difficult direction changes and unconventional movement, but suppresses Tech scoring when the map is more clearly a Stream or fast-jump Vibro map.",
      metrics: [{ label: "Tech movement", value: `${Math.round(techShare * 100)}%` }, { label: "Direction variation", value: `${Math.round(directionVariation * 100)}%` }, ...common],
    },
    {
      category: "off_grid",
      label: "Off Grid",
      score: fit(offGridFitRaw),
      suggestedLevel: level(offGridDifficulty),
      reason: "Uses timing-density variation, mixed patterns and direction variation as the off-grid signal while filtering out maps that are better explained by Stream or Vibro.",
      metrics: [{ label: "NPS variation", value: `${Math.round(npsVariation * 100)}%` }, { label: "Direction variation", value: `${Math.round(directionVariation * 100)}%` }, ...common],
    },
    {
      category: "vibro",
      label: "Vibro",
      score: fit(vibroFitRaw),
      suggestedLevel: level(vibroDifficulty),
      reason: "Treats Vibro as fast repeated jump-like movement. Lower levels can contain slower repeated jumps, while higher levels increasingly require very high jump NPS and strain.",
      metrics: [{ label: "Fast-jump share", value: `${Math.round(vibroShare * 100)}%` }, { label: "Peak jump NPS", value: input.peakJumpNps.toFixed(2) }, ...common],
    },
  ];
}
