import { roundRating } from "@/lib/ranks";
import type { MapNote, MapSectionAnalysis } from "@/lib/map-difficulty";

export const MAP_RANKABILITY_VERSION = 1;
export const MIN_POINT_RANKABILITY = 4;

export type RankabilityColor = "green" | "yellow" | "orange" | "red";
export type RankabilityMetricKey = "timing" | "nps" | "direction" | "spacing" | "quantum" | "spikes" | "vibro" | "coherence";
export type RankabilityMetric = { key: RankabilityMetricKey; label: string; score: number; detail: string };
export type RankabilityIssue = {
  type: "off_grid" | "mixed_nps" | "direction" | "spacing" | "quantum" | "difficulty_spike" | "vibro" | "pattern_noise";
  severity: number;
  startMs: number;
  endMs: number;
  title: string;
  detail: string;
};
export type MapPatternProfile = {
  streamRatio: number;
  jumpRatio: number;
  techRatio: number;
  vibroRatio: number;
  quantumRatio: number;
  offGridRatio: number;
};
export type MapRankabilityAnalysis = {
  version: number;
  score: number;
  color: RankabilityColor;
  label: string;
  summary: string;
  pointSafe: boolean;
  metrics: RankabilityMetric[];
  issues: RankabilityIssue[];
  patterns: MapPatternProfile;
};

type Transition = {
  time: number;
  dt: number;
  nps: number;
  distance: number;
  turn: number;
  quantum: boolean;
  stack: boolean;
};

type WindowStats = {
  startMs: number;
  endMs: number;
  transitions: Transition[];
  gridError: number;
  offGridRatio: number;
  npsInstability: number;
  rapidReversalRatio: number;
  spacingChaos: number;
  quantumNoise: number;
  vibroNoise: number;
  patternNoise: number;
};

function clamp(value: number, min = 0, max = 1) { return Math.min(max, Math.max(min, value)); }
function mean(values: number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
function coefficientOfVariation(values: number[]) {
  if (values.length < 3) return 0;
  const average = mean(values);
  if (average <= 0) return 0;
  const variance = mean(values.map((value) => (value - average) ** 2));
  return Math.sqrt(variance) / average;
}
function fractionalDistance(value: number, divisions: number) {
  const scaled = value * divisions;
  return Math.abs(scaled - Math.round(scaled)) / divisions;
}
function isQuantum(note: MapNote) {
  return fractionalDistance(note.x, 1) > 0.0005 || fractionalDistance(note.y, 1) > 0.0005;
}
function turnAmount(a: MapNote, b: MapNote, c: MapNote) {
  const ax = b.x - a.x;
  const ay = b.y - a.y;
  const bx = c.x - b.x;
  const by = c.y - b.y;
  const ad = Math.hypot(ax, ay);
  const bd = Math.hypot(bx, by);
  if (ad < 0.02 || bd < 0.02) return 0;
  const cosine = clamp((ax * bx + ay * by) / (ad * bd), -1, 1);
  return Math.acos(cosine) / Math.PI;
}
function buildTransitions(notes: MapNote[]) {
  const transitions: Transition[] = [];
  for (let index = 1; index < notes.length; index += 1) {
    const previous = notes[index - 1];
    const current = notes[index];
    const dt = current.time - previous.time;
    if (!Number.isFinite(dt) || dt <= 0 || dt > 1500) continue;
    const rawDistance = Math.hypot(current.x - previous.x, current.y - previous.y);
    transitions.push({
      time: current.time,
      dt,
      nps: 1000 / dt,
      distance: clamp(rawDistance / Math.sqrt(8), 0, 1.5),
      turn: index >= 2 ? turnAmount(notes[index - 2], previous, current) : 0,
      quantum: isQuantum(current),
      stack: rawDistance <= 0.03,
    });
  }
  return transitions;
}

function candidateGrid(intervals: number[]) {
  const usable = intervals.filter((value) => value >= 28 && value <= 1200);
  if (usable.length < 3) return 0;
  const candidates = new Map<number, number>();
  const divisions = [1, 2, 3, 4, 6, 8];
  for (const interval of usable.slice(0, 180)) {
    for (const divisor of divisions) {
      const step = interval / divisor;
      if (step < 28 || step > 400) continue;
      const key = Math.round(step * 2) / 2;
      candidates.set(key, (candidates.get(key) ?? 0) + 1);
    }
  }
  let bestStep = median(usable);
  let bestScore = -Infinity;
  for (const [step, support] of candidates) {
    const residuals = usable.map((interval) => {
      const multiple = Math.max(1, Math.round(interval / step));
      return Math.abs(interval - multiple * step) / step;
    });
    const fit = 1 - clamp(median(residuals) / 0.18);
    const complexityPenalty = step < 45 ? (45 - step) / 90 : 0;
    const score = fit * 1.5 + Math.min(0.3, support / Math.max(1, usable.length) * 0.3) - complexityPenalty;
    if (score > bestScore) { bestScore = score; bestStep = step; }
  }
  return bestStep;
}

function analyzeWindow(startMs: number, endMs: number, transitions: Transition[]): WindowStats {
  const intervals = transitions.map((transition) => transition.dt);
  const grid = candidateGrid(intervals);
  const gridResiduals = grid > 0 ? intervals.map((interval) => {
    const multiple = Math.max(1, Math.round(interval / grid));
    return Math.abs(interval - multiple * grid) / grid;
  }) : [];
  const gridError = clamp(median(gridResiduals) / 0.18);
  const offGridRatio = gridResiduals.length ? gridResiduals.filter((value) => value > 0.14).length / gridResiduals.length : 0;

  const npsValues = transitions.map((transition) => transition.nps).filter((value) => value <= 30);
  const npsCv = coefficientOfVariation(npsValues);
  let abruptNpsChanges = 0;
  for (let index = 1; index < transitions.length; index += 1) {
    const a = transitions[index - 1].dt;
    const b = transitions[index].dt;
    const ratio = Math.max(a, b) / Math.max(1, Math.min(a, b));
    if (ratio > 1.8 && a < 500 && b < 500) abruptNpsChanges += 1;
  }
  const npsInstability = clamp(npsCv * 0.65 + (transitions.length > 1 ? abruptNpsChanges / (transitions.length - 1) : 0) * 0.65);

  const rapid = transitions.filter((transition) => transition.dt <= 190 && transition.distance >= 0.08);
  const rapidReversals = rapid.filter((transition) => transition.turn >= 0.78 && transition.distance >= 0.14);
  const rapidReversalRatio = rapid.length ? rapidReversals.length / rapid.length : 0;

  let spacingJolts = 0;
  for (let index = 1; index < transitions.length; index += 1) {
    const previous = transitions[index - 1];
    const current = transitions[index];
    if (current.dt > 220) continue;
    const difference = Math.abs(current.distance - previous.distance);
    if (difference > 0.42 && Math.max(current.distance, previous.distance) > 0.5) spacingJolts += 1;
  }
  const spacingChaos = transitions.length > 1 ? spacingJolts / (transitions.length - 1) : 0;

  const quantumTransitions = transitions.filter((transition) => transition.quantum);
  let quantumBad = 0;
  for (const transition of quantumTransitions) {
    if (transition.dt <= 150 && transition.distance <= 0.055) quantumBad += 1;
  }
  const quantumNoise = quantumTransitions.length ? quantumBad / quantumTransitions.length : 0;

  const vibro = transitions.filter((transition) => transition.stack && transition.dt <= 105);
  const vibroIntervals = vibro.map((transition) => transition.dt);
  const vibroNoise = vibro.length >= 4 ? clamp(coefficientOfVariation(vibroIntervals) / 0.28) : 0;

  const classifications = transitions.map((transition) => transition.stack ? 0 : transition.distance >= 0.58 ? 2 : transition.turn >= 0.55 ? 1 : 0);
  let flips = 0;
  for (let index = 1; index < classifications.length; index += 1) if (classifications[index] !== classifications[index - 1]) flips += 1;
  const patternNoise = classifications.length > 4 ? clamp((flips / (classifications.length - 1) - 0.45) / 0.45) : 0;

  return { startMs, endMs, transitions, gridError, offGridRatio, npsInstability, rapidReversalRatio, spacingChaos, quantumNoise, vibroNoise, patternNoise };
}

function qualityDetail(score: number, good: string, bad: string) { return score >= 0.82 ? good : score >= 0.62 ? `${good} Some sections are less consistent.` : bad; }
function issue(startMs: number, endMs: number, type: RankabilityIssue["type"], severity: number, title: string, detail: string): RankabilityIssue {
  return { type, severity: roundRating(clamp(severity)), startMs, endMs, title, detail };
}

export function analyzeMapRankability(notes: MapNote[], sections: MapSectionAnalysis[]): MapRankabilityAnalysis {
  const clean = notes.filter((note) => Number.isFinite(note.time) && Number.isFinite(note.x) && Number.isFinite(note.y)).sort((a, b) => a.time - b.time);
  const transitions = buildTransitions(clean);
  const windowSize = 6000;
  const windows: WindowStats[] = [];
  const endMs = clean.length ? clean[clean.length - 1].time : 0;
  for (let start = 0; start <= endMs; start += windowSize) {
    const values = transitions.filter((transition) => transition.time >= start && transition.time < start + windowSize);
    if (values.length >= 3) windows.push(analyzeWindow(start, Math.min(endMs, start + windowSize), values));
  }

  const weighted = (key: keyof Pick<WindowStats, "gridError" | "offGridRatio" | "npsInstability" | "rapidReversalRatio" | "spacingChaos" | "quantumNoise" | "vibroNoise" | "patternNoise">) => {
    const total = windows.reduce((sum, window) => sum + window.transitions.length, 0);
    return total ? windows.reduce((sum, window) => sum + Number(window[key]) * window.transitions.length, 0) / total : 0;
  };

  const timingPenalty = clamp(weighted("gridError") * 0.55 + weighted("offGridRatio") * 0.75);
  const npsPenalty = clamp(weighted("npsInstability") * 0.95);
  const directionPenalty = clamp(weighted("rapidReversalRatio") * 2.3);
  const spacingPenalty = clamp(weighted("spacingChaos") * 2.5);
  const quantumPenalty = clamp(weighted("quantumNoise") * 1.6);
  const vibroPenalty = clamp(weighted("vibroNoise") * 0.9);
  const coherencePenalty = clamp(weighted("patternNoise") * 0.8);

  const activeStrains = sections.map((section) => section.strain).filter((value) => value > 0.05);
  const typicalStrain = median(activeStrains);
  const spikeSections = typicalStrain > 0 ? sections.filter((section) => section.strain > Math.max(typicalStrain * 2.45, typicalStrain + 0.9)) : [];
  const spikePenalty = sections.length ? clamp(spikeSections.length / Math.max(1, sections.length) * 5.5) : 0;

  const metricScores = {
    timing: clamp(1 - timingPenalty),
    nps: clamp(1 - npsPenalty),
    direction: clamp(1 - directionPenalty),
    spacing: clamp(1 - spacingPenalty),
    quantum: clamp(1 - quantumPenalty),
    spikes: clamp(1 - spikePenalty),
    vibro: clamp(1 - vibroPenalty),
    coherence: clamp(1 - coherencePenalty),
  };
  const metrics: RankabilityMetric[] = [
    { key: "timing", label: "Timing / grid", score: roundRating(metricScores.timing), detail: qualityDetail(metricScores.timing, "Timing follows a consistent inferred rhythmic grid.", "A noticeable amount of timing falls away from the map's dominant grid.") },
    { key: "nps", label: "NPS consistency", score: roundRating(metricScores.nps), detail: qualityDetail(metricScores.nps, "Speed changes are readable and structured.", "NPS changes are unusually mixed or abrupt inside active patterns.") },
    { key: "direction", label: "Direction readability", score: roundRating(metricScores.direction), detail: qualityDetail(metricScores.direction, "Direction changes are readable for their speed.", "Fast reversals create direction changes with limited reaction time.") },
    { key: "spacing", label: "Spacing balance", score: roundRating(metricScores.spacing), detail: qualityDetail(metricScores.spacing, "Spacing changes are controlled and predictable.", "Rapid spacing changes create aim spikes that do not flow cleanly.") },
    { key: "quantum", label: "Quantum control", score: roundRating(metricScores.quantum), detail: qualityDetail(metricScores.quantum, "Quantum positions are used in a controlled way.", "Some high-speed quantum movement behaves like small positional jitter rather than deliberate shape.") },
    { key: "spikes", label: "Difficulty balance", score: roundRating(metricScores.spikes), detail: qualityDetail(metricScores.spikes, "Difficulty is distributed without isolated unfair spikes.", "A small number of sections spike far above the map's normal strain.") },
    { key: "vibro", label: "Vibro control", score: roundRating(metricScores.vibro), detail: qualityDetail(metricScores.vibro, "Fast repeated notes keep a controlled rhythm.", "Vibro-like repeated notes have inconsistent timing and may be difficult to read fairly.") },
    { key: "coherence", label: "Pattern coherence", score: roundRating(metricScores.coherence), detail: qualityDetail(metricScores.coherence, "Streams, jumps and tech transitions are structured.", "Pattern types switch very frequently without stable phrasing.") },
  ];

  const weights: Record<RankabilityMetricKey, number> = { timing: 0.2, nps: 0.15, direction: 0.16, spacing: 0.12, quantum: 0.1, spikes: 0.12, vibro: 0.07, coherence: 0.08 };
  let quality = metrics.reduce((sum, metric) => sum + metric.score * weights[metric.key], 0);
  quality = clamp(quality);
  let score = 1 + quality * 4;

  const issues: RankabilityIssue[] = [];
  for (const window of windows) {
    if (window.offGridRatio >= 0.2 || window.gridError >= 0.62) issues.push(issue(window.startMs, window.endMs, "off_grid", Math.max(window.offGridRatio, window.gridError), "Off-grid timing", "This section has more timing deviation from its inferred dominant grid than a competitive ranked section normally should."));
    if (window.npsInstability >= 0.58) issues.push(issue(window.startMs, window.endMs, "mixed_nps", window.npsInstability, "Mixed NPS", "The local note speed changes frequently enough to reduce rhythmic predictability."));
    if (window.rapidReversalRatio >= 0.13) issues.push(issue(window.startMs, window.endMs, "direction", clamp(window.rapidReversalRatio * 3), "Abrupt direction changes", "Fast reversals combine movement and limited reaction time, making this section harder to read cleanly."));
    if (window.spacingChaos >= 0.12) issues.push(issue(window.startMs, window.endMs, "spacing", clamp(window.spacingChaos * 3), "Uneven spacing", "Spacing changes sharply inside a fast section instead of following a stable aim shape."));
    if (window.quantumNoise >= 0.22) issues.push(issue(window.startMs, window.endMs, "quantum", window.quantumNoise, "Noisy quantum movement", "Fractional positions create repeated micro-movement at speed; cleaning the shape would improve readability."));
    if (window.vibroNoise >= 0.55) issues.push(issue(window.startMs, window.endMs, "vibro", window.vibroNoise, "Irregular vibro", "Repeated near-stacked notes are fast but do not keep a stable enough interval to read as controlled vibro."));
    if (window.patternNoise >= 0.62) issues.push(issue(window.startMs, window.endMs, "pattern_noise", window.patternNoise, "Pattern switching", "Streams, jumps and tech-like movement change very frequently in this section."));
  }
  for (const section of spikeSections.slice(0, 8)) issues.push(issue(section.startMs, section.endMs, "difficulty_spike", clamp(section.strain / Math.max(0.01, typicalStrain * 3)), "Isolated difficulty spike", "This window is much harder than the map's typical active strain, which can make point competition less balanced."));

  const severe = issues.filter((entry) => entry.severity >= 0.75).length;
  const offGridRatio = weighted("offGridRatio");
  if (severe >= 4) score = Math.min(score, 3.89);
  if (offGridRatio >= 0.3) score = Math.min(score, 3.49);
  if (timingPenalty >= 0.75 && npsPenalty >= 0.65) score = Math.min(score, 2.99);
  score = Math.round(clamp(score, 1, 5) * 100) / 100;

  const streamLike = transitions.filter((transition) => !transition.stack && transition.distance < 0.38 && transition.turn < 0.48).length;
  const jumps = transitions.filter((transition) => transition.distance >= 0.58).length;
  const tech = transitions.filter((transition) => transition.distance >= 0.12 && transition.turn >= 0.55 && transition.nps >= 3.5).length;
  const vibro = transitions.filter((transition) => transition.stack && transition.dt <= 105).length;
  const quantum = transitions.filter((transition) => transition.quantum).length;
  const denominator = Math.max(1, transitions.length);
  const patterns: MapPatternProfile = {
    streamRatio: roundRating(streamLike / denominator),
    jumpRatio: roundRating(jumps / denominator),
    techRatio: roundRating(tech / denominator),
    vibroRatio: roundRating(vibro / denominator),
    quantumRatio: roundRating(quantum / denominator),
    offGridRatio: roundRating(offGridRatio),
  };

  const color: RankabilityColor = score >= 4 ? "green" : score >= 3 ? "yellow" : score >= 2 ? "orange" : "red";
  const label = score >= 4.5 ? "Excellent for ranked" : score >= 4 ? "Good for ranked" : score >= 3 ? "Rankable with cleanup" : score >= 2 ? "Unconventional / messy" : "Poor ranked candidate";
  const orderedIssues = [...issues].sort((a, b) => b.severity - a.severity || a.startMs - b.startMs).slice(0, 24);
  const strongest = metrics.filter((metric) => metric.score >= 0.86).map((metric) => metric.label.toLowerCase()).slice(0, 2);
  const weakest = metrics.filter((metric) => metric.score < 0.72).sort((a, b) => a.score - b.score).map((metric) => metric.label.toLowerCase()).slice(0, 2);
  const summary = weakest.length
    ? `${label}. Stronger areas: ${strongest.length ? strongest.join(" and ") : "overall structure"}. Main concerns: ${weakest.join(" and ")}.`
    : `${label}. The map is consistently readable across timing, spacing, direction changes and difficulty flow.`;

  return { version: MAP_RANKABILITY_VERSION, score, color, label, summary, pointSafe: score >= MIN_POINT_RANKABILITY, metrics, issues: orderedIssues, patterns };
}
