import type { MapDifficultyDetails, MapPatternSegment, MapSectionAnalysis } from "@/lib/map-difficulty";

export const CHALLENGE_FIT_ANALYZER_VERSION = 2;
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
  topSections?: MapSectionAnalysis[];
  details?: MapDifficultyDetails | null;
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * 100) / 100;
const fit = (quality: number) => round(1 + 4 * clamp(quality));
const level = (difficulty: number) => Math.max(1, Math.min(10, Math.round(1 + 9 * clamp(difficulty))));

function duration(segment: MapPatternSegment) {
  return Math.max(0, segment.endMs - segment.startMs);
}

function weightedAverage(items: MapPatternSegment[], value: (segment: MapPatternSegment) => number) {
  let total = 0;
  let weight = 0;
  for (const item of items) {
    const w = Math.max(1, duration(item));
    total += value(item) * w;
    weight += w;
  }
  return weight ? total / weight : 0;
}

function weightedShare(items: MapPatternSegment[], predicate: (segment: MapPatternSegment) => boolean) {
  const total = items.reduce((sum, item) => sum + duration(item), 0);
  if (!total) return 0;
  return items.filter(predicate).reduce((sum, item) => sum + duration(item), 0) / total;
}

function weightedPercentile(items: MapPatternSegment[], value: (segment: MapPatternSegment) => number, p: number) {
  const rows = items
    .map((segment) => ({ value: value(segment), weight: Math.max(1, duration(segment)) }))
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

function localVariation(items: MapPatternSegment[], value: (segment: MapPatternSegment) => number, scale: number) {
  if (items.length < 2) return 0;
  let weighted = 0;
  let weight = 0;
  for (let i = 1; i < items.length; i += 1) {
    const previous = items[i - 1];
    const current = items[i];
    const w = Math.max(1, Math.min(duration(previous), duration(current)));
    weighted += clamp(Math.abs(value(current) - value(previous)) / scale) * w;
    weight += w;
  }
  return weight ? clamp(weighted / weight) : 0;
}

function recurrence(items: MapPatternSegment[], predicate: (segment: MapPatternSegment) => boolean) {
  let groups = 0;
  let inGroup = false;
  for (const item of items) {
    if (predicate(item)) {
      if (!inGroup) groups += 1;
      inGroup = true;
    } else {
      inGroup = false;
    }
  }
  return clamp(groups / 5);
}

function categoryLevel(
  fitQuality: number,
  sustained: number,
  peak: number,
  timing: number,
  stamina: number,
  rating: number,
) {
  const normalizedRating = clamp((rating - 1.5) / 6.5);
  return level(
    0.24 * clamp(fitQuality) +
    0.24 * clamp(sustained / 3.2) +
    0.18 * clamp(peak / 4.2) +
    0.14 * clamp(timing / 3) +
    0.1 * clamp(stamina / 0.55) +
    0.1 * normalizedRating,
  );
}

export function challengeCategoryFits(input: ChallengeFitInput): ChallengeCategoryFit[] {
  const active = input.patternSegments
    .filter((segment) => segment.pattern !== "rest" && duration(segment) > 0)
    .sort((a, b) => a.startMs - b.startMs);

  if (!active.length) {
    return CHALLENGE_FIT_CATEGORIES.map((category) => ({
      category,
      label: CHALLENGE_FIT_LABELS[category],
      score: 1,
      suggestedLevel: 1,
      reason: "No active raw-map pattern data was available.",
      metrics: [],
    }));
  }

  const details = input.details ?? null;
  const totalMs = active.reduce((sum, item) => sum + duration(item), 0);
  const avgNps = weightedAverage(active, (segment) => Math.max(0, segment.averageNps));
  const avgDistance = weightedAverage(active, (segment) => clamp(segment.distance));
  const avgDirection = weightedAverage(active, (segment) => clamp(segment.direction));
  const avgJumpness = weightedAverage(active, (segment) => clamp(segment.jumpness));
  const avgTiming = weightedAverage(active, (segment) => Math.max(0, segment.timingPressure ?? 0));
  const avgCheese = weightedAverage(active, (segment) => clamp(segment.cheeseRatio ?? 0));

  const p80Strain = weightedPercentile(active, (segment) => Math.max(0, segment.averageStrain), 0.8);
  const p92Strain = weightedPercentile(active, (segment) => Math.max(0, segment.peakStrain), 0.92);
  const npsVariation = localVariation(active, (segment) => Math.min(32, Math.max(0, segment.averageNps)), 12);
  const directionVariation = localVariation(active, (segment) => clamp(segment.direction), 0.55);
  const distanceVariation = localVariation(active, (segment) => clamp(segment.distance), 0.55);

  const vibroPredicate = (segment: MapPatternSegment) =>
    segment.averageNps >= 15 &&
    segment.jumpness >= 0.68 &&
    (segment.distance >= 0.18 || segment.direction >= 0.12);

  const streamPredicate = (segment: MapPatternSegment) =>
    segment.averageNps >= 10.5 &&
    segment.jumpness <= 0.58 &&
    (segment.cheeseRatio ?? 0) < 0.7;

  const jumpPredicate = (segment: MapPatternSegment) =>
    segment.jumpness >= 0.68 &&
    segment.distance >= 0.5 &&
    segment.averageNps < 20;

  const techPredicate = (segment: MapPatternSegment) =>
    segment.direction >= 0.5 &&
    segment.averageStrain >= Math.max(0.55, p80Strain * 0.6);

  const offGridPredicate = (segment: MapPatternSegment, index: number) => {
    if (index === 0) return false;
    const previous = active[index - 1];
    const npsChange = Math.abs(segment.averageNps - previous.averageNps);
    const timingChange = Math.abs((segment.timingPressure ?? 0) - (previous.timingPressure ?? 0));
    return npsChange >= 5 || timingChange >= 0.7 || segment.pattern === "mixed";
  };

  const vibroShare = weightedShare(active, vibroPredicate);
  const streamShare = weightedShare(active, streamPredicate);
  const jumpShare = weightedShare(active, jumpPredicate);
  const techShare = weightedShare(active, techPredicate);
  const offGridShare = weightedShare(active, (segment) => offGridPredicate(segment, active.indexOf(segment)));

  const vibroRecurrence = recurrence(active, vibroPredicate);
  const streamRecurrence = recurrence(active, streamPredicate);
  const jumpRecurrence = recurrence(active, jumpPredicate);
  const techRecurrence = recurrence(active, techPredicate);

  const sustained = details?.sustainedDifficulty ?? p80Strain;
  const peak = details?.peakDifficulty ?? p92Strain;
  const timing = details?.timingPressure ?? avgTiming;
  const antiCheese = clamp(1 - Math.max(avgCheese, details?.cheeseRatio ?? 0));

  const vibroQuality = clamp(
    0.42 * clamp(vibroShare / 0.42) +
    0.22 * vibroRecurrence +
    0.16 * clamp(input.peakJumpNps / 30) +
    0.12 * clamp(avgTiming / 3) +
    0.08 * antiCheese,
  );

  const streamQuality = clamp(
    0.42 * clamp(streamShare / 0.48) +
    0.2 * streamRecurrence +
    0.16 * clamp(input.peakStreamNps / 18) +
    0.12 * clamp(input.staminaIndex / 0.45) +
    0.1 * clamp((1 - Math.abs(avgJumpness - 0.3)) / 0.8),
  );

  const jumpQuality = clamp(
    0.38 * clamp(jumpShare / 0.42) +
    0.2 * jumpRecurrence +
    0.18 * clamp(avgDistance / 0.78) +
    0.12 * clamp(input.peakJumpStrain / 4) +
    0.12 * antiCheese,
  ) * (1 - 0.32 * clamp(vibroShare / 0.65));

  const techQuality = clamp(
    0.38 * clamp(techShare / 0.4) +
    0.2 * techRecurrence +
    0.18 * clamp(avgDirection / 0.62) +
    0.14 * directionVariation +
    0.1 * clamp((details?.techPressure ?? p80Strain) / 2.6),
  ) * (1 - 0.18 * clamp(vibroShare / 0.6));

  const offGridQuality = clamp(
    0.32 * clamp(offGridShare / 0.45) +
    0.24 * npsVariation +
    0.18 * directionVariation +
    0.12 * distanceVariation +
    0.14 * clamp(weightedShare(active, (segment) => segment.pattern === "mixed") / 0.35),
  ) * (1 - 0.18 * clamp(vibroShare / 0.65));

  const categoryShares = [jumpShare, streamShare, techShare, offGridShare, vibroShare];
  const normalizedShares = categoryShares.map((value) => clamp(value));
  const meanShare = normalizedShares.reduce((sum, value) => sum + value, 0) / normalizedShares.length;
  const spread = Math.sqrt(
    normalizedShares.reduce((sum, value) => sum + (value - meanShare) ** 2, 0) / normalizedShares.length,
  );
  const challengeBalance = clamp(1 - spread / 0.36);
  const patternBreadth = clamp(normalizedShares.filter((value) => value >= 0.12).length / 4);
  const challengeQuality = clamp(
    0.3 * challengeBalance +
    0.22 * patternBreadth +
    0.18 * clamp(sustained / Math.max(0.2, peak)) +
    0.12 * clamp(input.staminaIndex / 0.45) +
    0.1 * antiCheese +
    0.08 * clamp((details?.difficultyConsistency ?? 0.65)),
  );

  const common = [
    { label: "Active map", value: `${Math.round(totalMs / 1000)}s` },
    { label: "Avg NPS", value: avgNps.toFixed(2) },
    { label: "Direction", value: input.directionScore.toFixed(2) },
    { label: "Distance", value: input.distanceScore.toFixed(2) },
  ];

  return [
    {
      category: "challenge",
      label: "Challenge",
      score: fit(challengeQuality),
      suggestedLevel: categoryLevel(challengeQuality, sustained, peak, timing, input.staminaIndex, input.rating),
      reason: "Challenge Fit v2 reads the full raw-map-derived pattern timeline and rewards maps that repeatedly test multiple skills without one isolated pattern or spike defining the placement.",
      metrics: [
        { label: "Skill balance", value: `${Math.round(challengeBalance * 100)}%` },
        { label: "Pattern breadth", value: `${Math.round(patternBreadth * 100)}%` },
        ...common,
      ],
    },
    {
      category: "jumps",
      label: "Jumps",
      score: fit(jumpQuality),
      suggestedLevel: categoryLevel(jumpQuality, details?.jumpPressure ?? sustained, input.peakJumpStrain, timing, input.staminaIndex, input.rating),
      reason: "Uses repeated raw spacing-heavy jump patterns, jump strain, timing pressure, and recurrence. Fast repeated jump sections are discounted toward Vibro when they dominate.",
      metrics: [
        { label: "Jump share", value: `${Math.round(jumpShare * 100)}%` },
        { label: "Jump recurrence", value: `${Math.round(jumpRecurrence * 100)}%` },
        { label: "Peak jump NPS", value: input.peakJumpNps.toFixed(2) },
        ...common,
      ],
    },
    {
      category: "stream",
      label: "Stream",
      score: fit(streamQuality),
      suggestedLevel: categoryLevel(streamQuality, details?.streamPressure ?? sustained, input.peakStreamStrain, timing, input.staminaIndex, input.rating),
      reason: "Uses sustained raw timing density, lower-jumpness movement, recurrence, stream strain, and stamina so one short fast burst cannot classify a whole map as Stream.",
      metrics: [
        { label: "Stream share", value: `${Math.round(streamShare * 100)}%` },
        { label: "Stream recurrence", value: `${Math.round(streamRecurrence * 100)}%` },
        { label: "Peak stream NPS", value: input.peakStreamNps.toFixed(2) },
        ...common,
      ],
    },
    {
      category: "tech",
      label: "Tech",
      score: fit(techQuality),
      suggestedLevel: categoryLevel(techQuality, details?.techPressure ?? sustained, peak, timing, input.staminaIndex, input.rating),
      reason: "Uses three-note raw direction changes, repeated technical sections, direction variation, and strain instead of relying on a single global direction score.",
      metrics: [
        { label: "Tech share", value: `${Math.round(techShare * 100)}%` },
        { label: "Tech recurrence", value: `${Math.round(techRecurrence * 100)}%` },
        { label: "Direction variation", value: `${Math.round(directionVariation * 100)}%` },
        ...common,
      ],
    },
    {
      category: "off_grid",
      label: "Off Grid",
      score: fit(offGridQuality),
      suggestedLevel: categoryLevel(offGridQuality, sustained, peak, timing, input.staminaIndex, input.rating),
      reason: "Uses local timing-density changes, mixed patterns, and movement variation from the raw note timeline. It measures repeated off-grid behavior rather than treating any NPS variation as Off Grid.",
      metrics: [
        { label: "Off-grid share", value: `${Math.round(offGridShare * 100)}%` },
        { label: "NPS variation", value: `${Math.round(npsVariation * 100)}%` },
        { label: "Direction variation", value: `${Math.round(directionVariation * 100)}%` },
        ...common,
      ],
    },
    {
      category: "vibro",
      label: "Vibro",
      score: fit(vibroQuality),
      suggestedLevel: categoryLevel(vibroQuality, details?.jumpPressure ?? sustained, input.peakJumpStrain, timing, input.staminaIndex, input.rating),
      reason: "Uses repeated high-NPS jump-like raw movement, timing pressure, recurrence, and anti-cheese checks so raw density alone cannot produce a high Vibro rating.",
      metrics: [
        { label: "Vibro share", value: `${Math.round(vibroShare * 100)}%` },
        { label: "Vibro recurrence", value: `${Math.round(vibroRecurrence * 100)}%` },
        { label: "Peak jump NPS", value: input.peakJumpNps.toFixed(2) },
        ...common,
      ],
    },
  ];
}
