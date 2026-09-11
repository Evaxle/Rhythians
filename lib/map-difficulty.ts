import { unzipSync } from "fflate";
import { roundRating } from "@/lib/ranks";

export const MAP_ANALYZER_VERSION = 5;
export const MIN_ANALYSIS_NOTES = 3;

export type MapNote = { time: number; x: number; y: number };
export type MapPattern = "rest" | "stream" | "stream-lean" | "mixed" | "jump-lean" | "jump";
export type MapSectionAnalysis = {
  startMs: number;
  endMs: number;
  strain: number;
  nps: number;
  jumpness: number;
  direction: number;
  distance: number;
  timingPressure?: number;
  cheeseRatio?: number;
  pattern: Exclude<MapPattern, "rest">;
};
export type MapPatternSegment = {
  startMs: number;
  endMs: number;
  pattern: MapPattern;
  averageStrain: number;
  peakStrain: number;
  averageNps: number;
  jumpness: number;
  direction: number;
  distance: number;
  timingPressure?: number;
  cheeseRatio?: number;
};
export type MapModeRewards = { lock: number; vr: number; spin: number };
export type MapSpeedProfile = { speed: number; rating: number; rewards: MapModeRewards };
export type DifficultyCoverage = { easy: number; moderate: number; hard: number; peak: number };
export type MapDifficultyDetails = {
  coreDifficulty: number;
  sustainedDifficulty: number;
  peakDifficulty: number;
  staminaDifficulty: number;
  movementPressure: number;
  directionPressure: number;
  distancePressure: number;
  timingPressure: number;
  jumpPressure: number;
  streamPressure: number;
  techPressure: number;
  cheeseRatio: number;
  activeDuty: number;
  recoveryRatio: number;
  patternDiversity: number;
  difficultyConsistency: number;
  coverage: DifficultyCoverage;
  windows: { micro: number; short: number; medium: number; long: number };
};
export type MapDifficultyAnalysis = {
  version: number;
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
  noteCount: number;
  rewards: MapModeRewards;
  speedProfiles: MapSpeedProfile[];
  topSections: MapSectionAnalysis[];
  patternSegments: MapPatternSegment[];
  details: MapDifficultyDetails;
};

type MarkerDefinition = { id: string; types: number[] };
type Transition = {
  time: number;
  deltaMs: number;
  strain: number;
  nps: number;
  jumpness: number;
  direction: number;
  distance: number;
  timingPressure: number;
  cheeseRatio: number;
};
type WindowPoint = { startMs: number; endMs: number; strain: number };
type SpeedAnalysis = {
  rating: number;
  staminaIndex: number;
  activeDurationMs: number;
  longestHardSectionMs: number;
  sections: MapSectionAnalysis[];
  transitions: Transition[];
  details: MapDifficultyDetails;
};

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const position = clamp(p, 0, 1) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const amount = position - lower;
  return sorted[lower] * (1 - amount) + sorted[upper] * amount;
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function deviation(values: number[]) {
  if (!values.length) return 0;
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

function sigmoid(value: number) {
  return 1 / (1 + Math.exp(-value));
}

function rounded(value: number, digits = 4) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function readString16(buffer: Buffer, cursor: number, end = buffer.length) {
  if (cursor + 2 > end) throw new Error("Invalid SSPM string.");
  const length = buffer.readUInt16LE(cursor);
  cursor += 2;
  if (cursor + length > end) throw new Error("Invalid SSPM string length.");
  return { value: buffer.subarray(cursor, cursor + length).toString("utf8"), cursor: cursor + length };
}

function skipMarkerValue(buffer: Buffer, cursor: number, type: number, end: number) {
  if (type === 0x01) cursor += 1;
  else if (type === 0x02) cursor += 2;
  else if (type === 0x03 || type === 0x05) cursor += 4;
  else if (type === 0x04 || type === 0x06) cursor += 8;
  else if (type === 0x08 || type === 0x09) {
    if (cursor + 2 > end) throw new Error("Invalid SSPM buffer value.");
    cursor += 2 + buffer.readUInt16LE(cursor);
  } else if (type === 0x0a || type === 0x0b) {
    if (cursor + 4 > end) throw new Error("Invalid SSPM long value.");
    cursor += 4 + buffer.readUInt32LE(cursor);
  } else if (type === 0x0c) {
    throw new Error("SSPM marker arrays are not supported.");
  } else {
    throw new Error(`Unsupported SSPM marker value type ${type}.`);
  }
  if (cursor > end) throw new Error("Invalid SSPM marker value length.");
  return cursor;
}

export function parseSspmNotes(data: Uint8Array): MapNote[] {
  const buffer = Buffer.from(data);
  if (buffer.length < 128 || buffer.readUInt32LE(0) !== 0x6d2b5353 || buffer.readUInt16LE(4) !== 2) {
    throw new Error("Only SSPM v2 maps can be analyzed by this parser.");
  }
  const markerCount = buffer.readUInt32LE(38);
  const definitionsOffset = Number(buffer.readBigUInt64LE(96));
  const definitionsLength = Number(buffer.readBigUInt64LE(104));
  const markersOffset = Number(buffer.readBigUInt64LE(112));
  const markersLength = Number(buffer.readBigUInt64LE(120));
  if (definitionsOffset < 0 || markersOffset < 0 || definitionsOffset + definitionsLength > buffer.length || markersOffset + markersLength > buffer.length) {
    throw new Error("SSPM map pointers are invalid.");
  }
  let cursor = definitionsOffset;
  const definitionsEnd = definitionsOffset + definitionsLength;
  if (cursor >= definitionsEnd) throw new Error("SSPM map has no marker definitions.");
  const definitionCount = buffer[cursor++];
  const definitions: MarkerDefinition[] = [];
  for (let i = 0; i < definitionCount; i += 1) {
    const name = readString16(buffer, cursor, definitionsEnd);
    cursor = name.cursor;
    if (cursor >= definitionsEnd) throw new Error("Invalid SSPM marker definition.");
    const valueCount = buffer[cursor++];
    const types: number[] = [];
    for (let j = 0; j < valueCount; j += 1) {
      if (cursor >= definitionsEnd) throw new Error("Invalid SSPM marker definition values.");
      const type = buffer[cursor++];
      types.push(type);
      if (type === 0x0c) {
        if (cursor >= definitionsEnd) throw new Error("Invalid SSPM array definition.");
        cursor += 1;
      }
    }
    if (cursor >= definitionsEnd || buffer[cursor++] !== 0) throw new Error("Invalid SSPM marker definition terminator.");
    definitions.push({ id: name.value, types });
  }
  const noteType = definitions.findIndex((definition) => definition.id === "ssp_note");
  if (noteType < 0) throw new Error("SSPM map does not define ssp_note markers.");
  const notes: MapNote[] = [];
  cursor = markersOffset;
  const markersEnd = markersOffset + markersLength;
  for (let marker = 0; marker < markerCount && cursor < markersEnd; marker += 1) {
    if (cursor + 5 > markersEnd) throw new Error("Invalid SSPM marker block.");
    const time = buffer.readUInt32LE(cursor);
    cursor += 4;
    const markerType = buffer[cursor++];
    const definition = definitions[markerType];
    if (!definition) throw new Error("SSPM marker references an unknown definition.");
    let position: { x: number; y: number } | null = null;
    for (const type of definition.types) {
      if (type === 0x07) {
        if (cursor + 1 > markersEnd) throw new Error("Invalid SSPM position marker.");
        const encoding = buffer[cursor++];
        if (encoding === 0) {
          if (cursor + 2 > markersEnd) throw new Error("Invalid SSPM integer position.");
          const x = buffer[cursor++];
          const y = buffer[cursor++];
          if (!position) position = { x, y };
        } else if (encoding === 1) {
          if (cursor + 8 > markersEnd) throw new Error("Invalid SSPM quantum position.");
          const x = buffer.readFloatLE(cursor);
          const y = buffer.readFloatLE(cursor + 4);
          cursor += 8;
          if (!position) position = { x, y };
        } else {
          throw new Error("Invalid SSPM position encoding.");
        }
      } else {
        cursor = skipMarkerValue(buffer, cursor, type, markersEnd);
      }
    }
    if (markerType === noteType && position && Number.isFinite(position.x) && Number.isFinite(position.y)) {
      notes.push({ time, x: position.x, y: position.y });
    }
  }
  return notes.sort((a, b) => a.time - b.time);
}

function notesFromObject(parsed: Record<string, unknown>): MapNote[] {
  const raw = Array.isArray(parsed.Notes) ? parsed.Notes as Array<Record<string, unknown>> : Array.isArray(parsed.notes) ? parsed.notes as Array<Record<string, unknown>> : [];
  return raw.map((note) => ({
    time: Number(note.Time ?? note.time),
    x: Number(note.X ?? note.x),
    y: Number(note.Y ?? note.y),
  })).filter((note) => Number.isFinite(note.time) && Number.isFinite(note.x) && Number.isFinite(note.y) && note.time >= 0).sort((a, b) => a.time - b.time);
}

export function parseRhmNotes(data: Uint8Array): MapNote[] {
  const files = unzipSync(data);
  const entry = Object.entries(files).find(([name]) => name.toLowerCase() === "map" || name.toLowerCase().endsWith("/map") || name.toLowerCase().endsWith("map.json"))?.[1];
  if (!entry) throw new Error("RHM archive does not contain a readable map entry.");
  return notesFromObject(JSON.parse(new TextDecoder().decode(entry)) as Record<string, unknown>);
}

function parseTextNotes(text: string): MapNote[] {
  const notes: MapNote[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;
    const numbers = line.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    if (numbers.length < 3) continue;
    const [time, x, y] = numbers;
    if (Number.isFinite(time) && Number.isFinite(x) && Number.isFinite(y) && time >= 0) notes.push({ time, x, y });
  }
  return notes.sort((a, b) => a.time - b.time);
}

export function parseMapNotes(data: Uint8Array): MapNote[] {
  const buffer = Buffer.from(data);
  if (buffer.length >= 6 && buffer.readUInt32LE(0) === 0x6d2b5353) return parseSspmNotes(data);
  if (buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b) return parseRhmNotes(data);
  const text = buffer.toString("utf8").trimStart();
  if (text.startsWith("{")) return notesFromObject(JSON.parse(text) as Record<string, unknown>);
  const textNotes = parseTextNotes(text);
  if (textNotes.length >= MIN_ANALYSIS_NOTES) return textNotes;
  throw new Error("Map file is not a supported SSPM v2, RHM, Rhythia JSON, or note text file.");
}

function distanceLoad(distance: number) {
  if (distance <= 0.015) return 0;
  const normalized = clamp(distance / Math.sqrt(8), 0, 1.25);
  const low = sigmoid((0 - 0.28) * 8.5);
  const high = sigmoid((1 - 0.28) * 8.5);
  return clamp((sigmoid((normalized - 0.28) * 8.5) - low) / Math.max(0.0001, high - low));
}

function angleLoad(a: MapNote, b: MapNote, c: MapNote) {
  const x1 = b.x - a.x;
  const y1 = b.y - a.y;
  const x2 = c.x - b.x;
  const y2 = c.y - b.y;
  const d1 = Math.hypot(x1, y1);
  const d2 = Math.hypot(x2, y2);
  if (d1 <= 0.015 || d2 <= 0.015) return 0;
  const cosine = clamp((x1 * x2 + y1 * y2) / (d1 * d2), -1, 1);
  const angle = Math.acos(cosine) / Math.PI;
  return Math.pow(angle, 1.3);
}

function timingLoad(nps: number) {
  return Math.min(4.25, Math.pow(Math.max(0, nps) / 5.8, 1.18));
}

function patternLabel(jumpness: number): MapSectionAnalysis["pattern"] {
  if (jumpness < 0.2) return "stream";
  if (jumpness < 0.4) return "stream-lean";
  if (jumpness < 0.6) return "mixed";
  if (jumpness < 0.8) return "jump-lean";
  return "jump";
}

function modeRewards(rating: number, staminaIndex: number): MapModeRewards {
  const r = Math.max(0, rating);
  const base = (12 + 8 * r + 1.5 * r * r) * (1 + 0.12 * clamp(staminaIndex));
  const lock = Math.max(1, Math.round(base));
  return { lock, vr: Math.max(lock, Math.round(lock * 1.06)), spin: Math.max(lock, Math.round(lock * 1.12)) };
}

function localDifficulty(strain: number) {
  return clamp(0.35 + 3.8 * Math.log1p(Math.max(0, strain)), 0, 12);
}

function buildTransitions(notes: MapNote[], speed: number): Transition[] {
  const safeSpeed = clamp(speed, 0.5, 2);
  const transitions: Transition[] = [];
  for (let i = 1; i < notes.length; i += 1) {
    const previous = notes[i - 1];
    const current = notes[i];
    const rawDelta = current.time - previous.time;
    if (!Number.isFinite(rawDelta) || rawDelta <= 0 || rawDelta > 2500) continue;
    const deltaMs = rawDelta / safeSpeed;
    const rawDistance = Math.hypot(current.x - previous.x, current.y - previous.y);
    const distance = distanceLoad(rawDistance);
    const direction = i >= 2 ? angleLoad(notes[i - 2], previous, current) : 0;
    const nps = 1000 / deltaMs;
    const stack = rawDistance <= 0.03;
    const timingPressure = clamp((nps - 2.5) / 11.5);
    const movementPressure = clamp(0.7 * distance + 0.3 * direction);
    const cheeseRatio = stack ? clamp((nps - 5) / 11) : clamp((nps - 9) / 15) * clamp((0.22 - movementPressure) / 0.22);
    const movementBase = stack ? 0.06 : 0.2 + 0.8 * distance;
    const directionMultiplier = 0.72 + 0.66 * direction;
    const interaction = 1 + 0.3 * timingPressure * distance + 0.25 * timingPressure * direction;
    const jumpness = stack ? 0 : clamp(0.78 * distance + 0.22 * direction);
    const speedPatternMultiplier = safeSpeed <= 1 ? 1 : Math.pow(safeSpeed, 0.3 + 0.4 * jumpness + 0.15 * direction);
    const strain = timingLoad(nps) * movementBase * directionMultiplier * interaction * speedPatternMultiplier * (1 - 0.52 * cheeseRatio);
    transitions.push({ time: current.time, deltaMs, strain, nps, jumpness, direction, distance, timingPressure, cheeseRatio });
  }
  return transitions;
}

function windowStrain(transitions: Transition[], windowMs: number): WindowPoint[] {
  if (!transitions.length) return [];
  const result: WindowPoint[] = [];
  let left = 0;
  for (let right = 0; right < transitions.length; right += 1) {
    const endMs = transitions[right].time;
    while (left < right && transitions[left].time < endMs - windowMs) left += 1;
    const slice = transitions.slice(left, right + 1);
    if (!slice.length) continue;
    const strains = slice.map((item) => item.strain);
    const meanStrain = mean(strains);
    const upper = percentile(strains, 0.85);
    const density = clamp(slice.length / Math.max(1, windowMs / 125), 0, 1);
    const strain = (0.58 * meanStrain + 0.42 * upper) * (0.88 + 0.12 * density);
    result.push({ startMs: Math.max(0, endMs - windowMs), endMs, strain });
  }
  return result;
}

function summarizeWindow(points: WindowPoint[]) {
  const values = points.map((point) => point.strain);
  return {
    p50: percentile(values, 0.5),
    p70: percentile(values, 0.7),
    p85: percentile(values, 0.85),
    p95: percentile(values, 0.95),
  };
}

function buildSections(transitions: Transition[], bucketMs = 1500): MapSectionAnalysis[] {
  const buckets = new Map<number, Transition[]>();
  for (const transition of transitions) {
    const index = Math.floor(transition.time / bucketMs);
    const list = buckets.get(index) ?? [];
    list.push(transition);
    buckets.set(index, list);
  }
  return [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([index, values]) => {
    const weights = values.map((value) => Math.max(0.02, value.strain));
    const totalWeight = weights.reduce((sum, value) => sum + value, 0);
    const weighted = (selector: (value: Transition) => number) => values.reduce((sum, value, i) => sum + selector(value) * weights[i], 0) / Math.max(0.001, totalWeight);
    const strains = values.map((value) => value.strain);
    const strain = 0.62 * mean(strains) + 0.38 * percentile(strains, 0.88);
    const jumpness = clamp(weighted((value) => value.jumpness));
    return {
      startMs: index * bucketMs,
      endMs: index * bucketMs + bucketMs,
      strain,
      nps: weighted((value) => value.nps),
      jumpness,
      direction: weighted((value) => value.direction),
      distance: weighted((value) => value.distance),
      timingPressure: weighted((value) => value.timingPressure),
      cheeseRatio: weighted((value) => value.cheeseRatio),
      pattern: patternLabel(jumpness),
    };
  });
}

function longestHardRun(sections: MapSectionAnalysis[], threshold: number) {
  let longest = 0;
  let current = 0;
  let previousIndex: number | null = null;
  for (const section of sections) {
    if (section.strain < threshold) continue;
    const index = Math.floor(section.startMs / 1500);
    current = previousIndex != null && index === previousIndex + 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
    previousIndex = index;
  }
  return longest * 1500;
}

function patternDiversity(sections: MapSectionAnalysis[]) {
  if (!sections.length) return 0;
  const counts = new Map<string, number>();
  for (const section of sections) counts.set(section.pattern, (counts.get(section.pattern) ?? 0) + 1);
  const probabilities = [...counts.values()].map((count) => count / sections.length);
  const entropy = -probabilities.reduce((sum, p) => sum + (p > 0 ? p * Math.log(p) : 0), 0);
  return clamp(entropy / Math.log(5));
}

function analyzeAtSpeed(notes: MapNote[], speed: number): SpeedAnalysis {
  const transitions = buildTransitions(notes, speed);
  const sections = buildSections(transitions);
  if (!transitions.length || !sections.length) throw new Error("Map has too little playable note movement for analysis.");

  const micro = summarizeWindow(windowStrain(transitions, 500));
  const short = summarizeWindow(windowStrain(transitions, 1500));
  const medium = summarizeWindow(windowStrain(transitions, 6000));
  const long = summarizeWindow(windowStrain(transitions, 18000));

  const coreStrain = 0.4 * short.p50 + 0.35 * short.p70 + 0.25 * medium.p50;
  const sustainedStrain = 0.48 * medium.p85 + 0.34 * long.p70 + 0.18 * short.p85;
  const peakStrain = 0.55 * micro.p95 + 0.3 * short.p95 + 0.15 * medium.p95;
  const hardThreshold = Math.max(short.p85 * 0.82, short.p70);
  const longestHardSectionMs = longestHardRun(sections, hardThreshold);

  const first = transitions[0].time;
  const last = transitions[transitions.length - 1].time;
  const spanMs = Math.max(1500, last - first);
  const activeDurationMs = sections.length * 1500;
  const activeDuty = clamp(activeDurationMs / spanMs);
  const recoveryRatio = 1 - activeDuty;
  const hardRatio = sections.filter((section) => section.strain >= hardThreshold).length / Math.max(1, sections.length);
  const sustainedRun = clamp(longestHardSectionMs / 60000);
  const staminaIndex = clamp(0.42 * hardRatio + 0.38 * sustainedRun + 0.2 * activeDuty);

  const movementPressure = clamp(mean(transitions.map((value) => 0.58 * value.distance + 0.42 * value.direction)));
  const directionPressure = clamp(percentile(transitions.map((value) => value.direction), 0.78));
  const distancePressure = clamp(percentile(transitions.map((value) => value.distance), 0.78));
  const timingPressure = clamp(percentile(transitions.map((value) => value.timingPressure), 0.78));
  const cheeseRatio = clamp(mean(transitions.map((value) => value.cheeseRatio)));
  const jumpTransitions = transitions.filter((value) => value.jumpness >= 0.55);
  const streamTransitions = transitions.filter((value) => value.jumpness < 0.4);
  const jumpPressure = clamp((percentile(jumpTransitions.map((value) => value.strain), 0.8) || 0) / 2.5);
  const streamPressure = clamp((percentile(streamTransitions.map((value) => value.strain), 0.8) || 0) / 2.5);
  const techPressure = clamp(0.5 * directionPressure + 0.25 * clamp(deviation(transitions.map((value) => value.direction)) * 3) + 0.25 * clamp(deviation(transitions.map((value) => value.distance)) * 3));

  const localRatings = sections.map((section) => localDifficulty(section.strain));
  const p50Rating = percentile(localRatings, 0.5);
  const p80Rating = percentile(localRatings, 0.8);
  const p95Rating = percentile(localRatings, 0.95);
  const peakBand = Math.max(0.1, p95Rating - p50Rating);
  let easy = 0;
  let moderate = 0;
  let hard = 0;
  let peak = 0;
  for (const value of localRatings) {
    if (value <= p50Rating - 0.25 * peakBand) easy += 1;
    else if (value <= p50Rating + 0.2 * peakBand) moderate += 1;
    else if (value <= p80Rating + 0.25 * peakBand) hard += 1;
    else peak += 1;
  }
  const sectionCount = Math.max(1, localRatings.length);
  const coverage = { easy: easy / sectionCount, moderate: moderate / sectionCount, hard: hard / sectionCount, peak: peak / sectionCount };
  const consistency = clamp(1 - deviation(localRatings) / Math.max(1.2, mean(localRatings)));

  const coreDifficulty = localDifficulty(coreStrain);
  const sustainedDifficulty = localDifficulty(sustainedStrain);
  const peakDifficulty = localDifficulty(peakStrain);
  const staminaDifficulty = clamp(sustainedDifficulty * (0.78 + 0.22 * staminaIndex), 0, 12);
  const balanced = 0.42 * coreDifficulty + 0.38 * sustainedDifficulty + 0.12 * peakDifficulty + 0.08 * staminaDifficulty;
  const peakGuard = clamp((peakDifficulty - sustainedDifficulty - 1.1) / 3.2);
  const coverageGuard = clamp(coverage.peak * 3.5 + coverage.hard * 1.6);
  const guarded = balanced * (1 - 0.08 * peakGuard * (1 - coverageGuard));
  const rating = roundRating(clamp(guarded, 0, 12));

  const details: MapDifficultyDetails = {
    coreDifficulty: roundRating(coreDifficulty),
    sustainedDifficulty: roundRating(sustainedDifficulty),
    peakDifficulty: roundRating(peakDifficulty),
    staminaDifficulty: roundRating(staminaDifficulty),
    movementPressure: rounded(movementPressure),
    directionPressure: rounded(directionPressure),
    distancePressure: rounded(distancePressure),
    timingPressure: rounded(timingPressure),
    jumpPressure: rounded(jumpPressure),
    streamPressure: rounded(streamPressure),
    techPressure: rounded(techPressure),
    cheeseRatio: rounded(cheeseRatio),
    activeDuty: rounded(activeDuty),
    recoveryRatio: rounded(recoveryRatio),
    patternDiversity: rounded(patternDiversity(sections)),
    difficultyConsistency: rounded(consistency),
    coverage: {
      easy: rounded(coverage.easy),
      moderate: rounded(coverage.moderate),
      hard: rounded(coverage.hard),
      peak: rounded(coverage.peak),
    },
    windows: {
      micro: roundRating(localDifficulty(micro.p85)),
      short: roundRating(localDifficulty(short.p85)),
      medium: roundRating(localDifficulty(medium.p85)),
      long: roundRating(localDifficulty(long.p85)),
    },
  };

  return { rating, staminaIndex, activeDurationMs, longestHardSectionMs, sections, transitions, details };
}

function buildPatternSegments(sections: MapSectionAnalysis[], endMs: number): MapPatternSegment[] {
  if (endMs <= 0) return [];
  const sectionMap = new Map(sections.map((section) => [Math.floor(section.startMs / 1500), section]));
  const bucketCount = Math.max(1, Math.ceil(endMs / 1500));
  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const section = sectionMap.get(index);
    if (!section) return { startMs: index * 1500, endMs: Math.min(endMs, index * 1500 + 1500), pattern: "rest" as const, strain: 0, peak: 0, nps: 0, jumpness: 0, direction: 0, distance: 0, timingPressure: 0, cheeseRatio: 0 };
    return {
      startMs: section.startMs,
      endMs: Math.min(endMs, section.endMs),
      pattern: section.pattern as MapPattern,
      strain: section.strain,
      peak: section.strain,
      nps: section.nps,
      jumpness: section.jumpness,
      direction: section.direction,
      distance: section.distance,
      timingPressure: section.timingPressure ?? 0,
      cheeseRatio: section.cheeseRatio ?? 0,
    };
  }).filter((bucket) => bucket.endMs > bucket.startMs);

  const groups: typeof buckets[] = [];
  for (const bucket of buckets) {
    const last = groups[groups.length - 1];
    if (last && last[last.length - 1].pattern === bucket.pattern && last[last.length - 1].endMs === bucket.startMs) last.push(bucket);
    else groups.push([bucket]);
  }

  return groups.map((group) => {
    const pattern = group[0].pattern;
    const active = pattern === "rest" ? [] : group;
    const avg = (selector: (item: typeof group[number]) => number) => active.length ? mean(active.map(selector)) : 0;
    return {
      startMs: group[0].startMs,
      endMs: group[group.length - 1].endMs,
      pattern,
      averageStrain: roundRating(avg((item) => item.strain)),
      peakStrain: roundRating(Math.max(...group.map((item) => item.peak))),
      averageNps: roundRating(avg((item) => item.nps)),
      jumpness: roundRating(avg((item) => item.jumpness)),
      direction: roundRating(avg((item) => item.direction)),
      distance: roundRating(avg((item) => item.distance)),
      timingPressure: rounded(avg((item) => item.timingPressure)),
      cheeseRatio: rounded(avg((item) => item.cheeseRatio)),
    };
  });
}

export function analyzeMapNotes(notes: MapNote[]): MapDifficultyAnalysis {
  const clean = notes.filter((note) => Number.isFinite(note.time) && Number.isFinite(note.x) && Number.isFinite(note.y)).sort((a, b) => a.time - b.time);
  if (clean.length < MIN_ANALYSIS_NOTES) throw new Error(`Map needs at least ${MIN_ANALYSIS_NOTES} valid notes for difficulty analysis.`);

  const base = analyzeAtSpeed(clean, 1);
  const directionScore = roundRating(clamp(0.65 * base.details.directionPressure + 0.35 * percentile(base.transitions.map((value) => value.direction), 0.9), 0, 1) * 10);
  const distanceScore = roundRating(clamp(0.65 * base.details.distancePressure + 0.35 * percentile(base.transitions.map((value) => value.distance), 0.9), 0, 1) * 10);
  const npsScore = roundRating(clamp(0.7 * base.details.timingPressure + 0.3 * clamp(percentile(base.transitions.map((value) => value.nps), 0.9) / 16), 0, 1) * 10);
  const jumpTransitions = base.transitions.filter((value) => value.jumpness >= 0.55);
  const streamTransitions = base.transitions.filter((value) => value.jumpness < 0.4);
  const peakJumpNps = roundRating(percentile(jumpTransitions.map((value) => value.nps), 0.95));
  const peakStreamNps = roundRating(percentile(streamTransitions.map((value) => value.nps), 0.95));
  const peakJumpStrain = roundRating(percentile(jumpTransitions.map((value) => value.strain), 0.95));
  const peakStreamStrain = roundRating(percentile(streamTransitions.map((value) => value.strain), 0.95));
  const weightedJump = base.transitions.reduce((sum, value) => sum + value.jumpness * Math.max(0.01, value.strain), 0);
  const totalWeight = base.transitions.reduce((sum, value) => sum + Math.max(0.01, value.strain), 0);
  const jumpRatio = roundRating(clamp(weightedJump / Math.max(0.01, totalWeight), 0, 1));
  const rewards = modeRewards(base.rating, base.staminaIndex);

  const speedProfiles: MapSpeedProfile[] = [];
  for (let step = 10; step <= 40; step += 1) {
    const speed = step / 20;
    const analysis = speed === 1 ? base : analyzeAtSpeed(clean, speed);
    speedProfiles.push({ speed: roundRating(speed), rating: analysis.rating, rewards: modeRewards(analysis.rating, analysis.staminaIndex) });
  }

  const topSections = [...base.sections].sort((a, b) => b.strain - a.strain).slice(0, 10).map((section) => ({
    ...section,
    strain: roundRating(section.strain),
    nps: roundRating(section.nps),
    jumpness: roundRating(section.jumpness),
    direction: roundRating(section.direction),
    distance: roundRating(section.distance),
    timingPressure: rounded(section.timingPressure ?? 0),
    cheeseRatio: rounded(section.cheeseRatio ?? 0),
  }));

  const patternSegments = buildPatternSegments(base.sections, Math.max(clean[clean.length - 1].time, 1500));
  return {
    version: MAP_ANALYZER_VERSION,
    rating: base.rating,
    directionScore,
    distanceScore,
    npsScore,
    staminaIndex: rounded(base.staminaIndex),
    activeDurationMs: base.activeDurationMs,
    longestHardSectionMs: base.longestHardSectionMs,
    peakJumpNps,
    peakStreamNps,
    peakJumpStrain,
    peakStreamStrain,
    jumpRatio,
    noteCount: clean.length,
    rewards,
    speedProfiles,
    topSections,
    patternSegments,
    details: base.details,
  };
}

export function analyzeMapBytes(data: Uint8Array) {
  return analyzeMapNotes(parseMapNotes(data));
}

export function speedProfileAt(profiles: MapSpeedProfile[], requestedSpeed: number | null | undefined) {
  if (!profiles.length) return null;
  const speed = clamp(Number(requestedSpeed) || 1, 0.5, 2);
  const sorted = [...profiles].sort((a, b) => a.speed - b.speed);
  const exact = sorted.find((profile) => Math.abs(profile.speed - speed) < 0.0001);
  if (exact) return exact;
  const lower = [...sorted].reverse().find((profile) => profile.speed < speed) ?? sorted[0];
  const upper = sorted.find((profile) => profile.speed > speed) ?? sorted[sorted.length - 1];
  if (lower.speed === upper.speed) return lower;
  const amount = (speed - lower.speed) / (upper.speed - lower.speed);
  const interpolate = (a: number, b: number) => a + (b - a) * amount;
  return {
    speed: roundRating(speed),
    rating: roundRating(interpolate(lower.rating, upper.rating)),
    rewards: {
      lock: Math.round(interpolate(lower.rewards.lock, upper.rewards.lock)),
      vr: Math.round(interpolate(lower.rewards.vr, upper.rewards.vr)),
      spin: Math.round(interpolate(lower.rewards.spin, upper.rewards.spin)),
    },
  };
}
