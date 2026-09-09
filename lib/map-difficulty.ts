import { unzipSync } from "fflate";
import { roundRating } from "@/lib/ranks";

export const MAP_ANALYZER_VERSION = 2;
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
};
export type MapModeRewards = { lock: number; vr: number; spin: number };
export type MapSpeedProfile = { speed: number; rating: number; rewards: MapModeRewards };
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
};

type MarkerDefinition = { id: string; types: number[] };
type Transition = { time: number; strain: number; nps: number; jumpness: number; direction: number; distance: number };
type SpeedAnalysis = { rating: number; staminaIndex: number; activeDurationMs: number; longestHardSectionMs: number; sections: MapSectionAnalysis[]; transitions: Transition[] };

function clamp(value: number, min = 0, max = 1) { return Math.min(max, Math.max(min, value)); }
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
function sigmoid(value: number) { return 1 / (1 + Math.exp(-value)); }
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
  } else if (type === 0x0c) throw new Error("SSPM marker arrays are not supported.");
  else throw new Error(`Unsupported SSPM marker value type ${type}.`);
  if (cursor > end) throw new Error("Invalid SSPM marker value length.");
  return cursor;
}

export function parseSspmNotes(data: Uint8Array): MapNote[] {
  const buffer = Buffer.from(data);
  if (buffer.length < 128 || buffer.readUInt32LE(0) !== 0x6d2b5353 || buffer.readUInt16LE(4) !== 2) throw new Error("Only SSPM v2 maps can be analyzed.");
  const markerCount = buffer.readUInt32LE(38);
  const definitionsOffset = Number(buffer.readBigUInt64LE(96));
  const definitionsLength = Number(buffer.readBigUInt64LE(104));
  const markersOffset = Number(buffer.readBigUInt64LE(112));
  const markersLength = Number(buffer.readBigUInt64LE(120));
  if (definitionsOffset < 0 || markersOffset < 0 || definitionsOffset + definitionsLength > buffer.length || markersOffset + markersLength > buffer.length) throw new Error("SSPM map pointers are invalid.");
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
        } else throw new Error("Invalid SSPM position encoding.");
      } else cursor = skipMarkerValue(buffer, cursor, type, markersEnd);
    }
    if (markerType === noteType && position && Number.isFinite(position.x) && Number.isFinite(position.y)) notes.push({ time, x: position.x, y: position.y });
  }
  return notes.sort((a, b) => a.time - b.time);
}

export function parseRhmNotes(data: Uint8Array): MapNote[] {
  const files = unzipSync(data);
  const entry = Object.entries(files).find(([name]) => name.toLowerCase() === "map" || name.toLowerCase().endsWith("/map"))?.[1];
  if (!entry) throw new Error("RHM archive does not contain a map entry.");
  const parsed = JSON.parse(new TextDecoder().decode(entry)) as Record<string, unknown>;
  const raw = Array.isArray(parsed.Notes) ? parsed.Notes as Array<Record<string, unknown>> : [];
  return raw.map((note) => ({ time: Number(note.Time), x: Number(note.X), y: Number(note.Y) })).filter((note) => Number.isFinite(note.time) && Number.isFinite(note.x) && Number.isFinite(note.y) && note.time >= 0).sort((a, b) => a.time - b.time);
}

export function parseMapNotes(data: Uint8Array): MapNote[] {
  const buffer = Buffer.from(data);
  if (buffer.length >= 6 && buffer.readUInt32LE(0) === 0x6d2b5353) return parseSspmNotes(data);
  if (buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b) return parseRhmNotes(data);
  const text = buffer.subarray(0, Math.min(buffer.length, 64)).toString("utf8").trimStart();
  if (text.startsWith("{")) {
    const parsed = JSON.parse(buffer.toString("utf8")) as Record<string, unknown>;
    const raw = Array.isArray(parsed.Notes) ? parsed.Notes as Array<Record<string, unknown>> : [];
    return raw.map((note) => ({ time: Number(note.Time), x: Number(note.X), y: Number(note.Y) })).filter((note) => Number.isFinite(note.time) && Number.isFinite(note.x) && Number.isFinite(note.y) && note.time >= 0).sort((a, b) => a.time - b.time);
  }
  throw new Error("Map file is not a supported SSPM v2, RHM, or Rhythia map JSON file.");
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
  return Math.pow(angle, 1.35);
}
function timingLoad(nps: number) { return Math.min(4.5, Math.pow(Math.max(0, nps) / 5.5, 1.22)); }
function patternLabel(jumpness: number): MapSectionAnalysis["pattern"] {
  if (jumpness < 0.2) return "stream";
  if (jumpness < 0.4) return "stream-lean";
  if (jumpness < 0.6) return "mixed";
  if (jumpness < 0.8) return "jump-lean";
  return "jump";
}
function modeRewards(rating: number, staminaIndex: number): MapModeRewards {
  const r = Math.max(0, rating);
  const base = (12 + 8 * r + 1.5 * r * r) * (1 + 0.15 * clamp(staminaIndex));
  const lock = Math.max(1, Math.round(base));
  return { lock, vr: Math.max(lock, Math.round(lock * 1.06)), spin: Math.max(lock, Math.round(lock * 1.12)) };
}

function analyzeAtSpeed(notes: MapNote[], speed: number): SpeedAnalysis {
  const safeSpeed = clamp(speed, 0.5, 2);
  const transitions: Transition[] = [];
  for (let i = 1; i < notes.length; i += 1) {
    const previous = notes[i - 1];
    const current = notes[i];
    const deltaMs = current.time - previous.time;
    if (!Number.isFinite(deltaMs) || deltaMs <= 0 || deltaMs > 1500) continue;
    const distance = Math.hypot(current.x - previous.x, current.y - previous.y);
    const spacing = distanceLoad(distance);
    const direction = i >= 2 ? angleLoad(notes[i - 2], previous, current) : 0;
    const nps = 1000 / (deltaMs / safeSpeed);
    const stack = distance <= 0.03;
    const movement = stack ? 0.055 : 0.28 + 0.72 * spacing;
    const directionMultiplier = 0.68 + 0.62 * direction;
    const jumpness = stack ? 0 : spacing;
    const patternSpeed = safeSpeed <= 1 ? 1 : Math.pow(safeSpeed, 0.55 * jumpness + 0.2 * direction);
    const strain = timingLoad(nps) * movement * directionMultiplier * patternSpeed;
    transitions.push({ time: current.time, strain, nps, jumpness, direction, distance: spacing });
  }
  const buckets = new Map<number, Transition[]>();
  for (const transition of transitions) {
    const index = Math.floor(transition.time / 1500);
    const list = buckets.get(index) ?? [];
    list.push(transition);
    buckets.set(index, list);
  }
  const sections: MapSectionAnalysis[] = [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([index, values]) => {
    const strains = values.map((value) => value.strain);
    const peak = percentile(strains, 0.9);
    const mean = strains.reduce((sum, value) => sum + value, 0) / Math.max(1, strains.length);
    const totalWeight = values.reduce((sum, value) => sum + Math.max(0.01, value.strain), 0);
    const weighted = (key: "jumpness" | "direction" | "distance" | "nps") => values.reduce((sum, value) => sum + value[key] * Math.max(0.01, value.strain), 0) / Math.max(0.01, totalWeight);
    const jumpness = weighted("jumpness");
    return { startMs: index * 1500, endMs: index * 1500 + 1500, strain: peak * 0.58 + mean * 0.42, nps: weighted("nps"), jumpness, direction: weighted("direction"), distance: weighted("distance"), pattern: patternLabel(jumpness) };
  });
  const strains = sections.map((section) => section.strain);
  const p95 = percentile(strains, 0.95);
  const p80 = percentile(strains, 0.8);
  const p60 = percentile(strains, 0.6);
  const core = 0.55 * p95 + 0.3 * p80 + 0.15 * p60;
  const hardThreshold = Math.max(p80, p95 * 0.62);
  const hardIndexes = new Set(sections.filter((section) => section.strain >= hardThreshold && section.strain > 0.05).map((section) => Math.floor(section.startMs / 1500)));
  let longestRun = 0;
  let currentRun = 0;
  let previousIndex: number | null = null;
  for (const index of [...hardIndexes].sort((a, b) => a - b)) {
    currentRun = previousIndex != null && index === previousIndex + 1 ? currentRun + 1 : 1;
    longestRun = Math.max(longestRun, currentRun);
    previousIndex = index;
  }
  const hardDuty = sections.length ? hardIndexes.size / sections.length : 0;
  const longestHardSectionMs = longestRun * 1500;
  const staminaIndex = clamp(0.55 * hardDuty + 0.45 * Math.min(1, longestHardSectionMs / 45000));
  const activeDurationMs = sections.length * 1500;
  const adjustedCore = core * (1 + 0.08 * staminaIndex);
  const rating = roundRating(clamp(0.35 + 3.9 * Math.log1p(Math.max(0, adjustedCore)), 0, 12));
  return { rating, staminaIndex, activeDurationMs, longestHardSectionMs, sections, transitions };
}

function buildPatternSegments(sections: MapSectionAnalysis[], endMs: number): MapPatternSegment[] {
  if (endMs <= 0) return [];
  const sectionMap = new Map(sections.map((section) => [Math.floor(section.startMs / 1500), section]));
  const bucketCount = Math.max(1, Math.ceil(endMs / 1500));
  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const section = sectionMap.get(index);
    if (!section) return { startMs: index * 1500, endMs: Math.min(endMs, index * 1500 + 1500), pattern: "rest" as const, strain: 0, peak: 0, nps: 0, jumpness: 0, direction: 0, distance: 0 };
    return { startMs: section.startMs, endMs: Math.min(endMs, section.endMs), pattern: section.pattern as MapPattern, strain: section.strain, peak: section.strain, nps: section.nps, jumpness: section.jumpness, direction: section.direction, distance: section.distance };
  }).filter((bucket) => bucket.endMs > bucket.startMs);
  const groups: typeof buckets[] = [];
  for (const bucket of buckets) {
    const last = groups[groups.length - 1];
    if (last && last[last.length - 1].pattern === bucket.pattern && last[last.length - 1].endMs === bucket.startMs) last.push(bucket);
    else groups.push([bucket]);
  }
  return groups.map((group) => {
    const pattern = group[0].pattern;
    const active = pattern === "rest" ? 0 : group.length;
    const average = (key: "strain" | "nps" | "jumpness" | "direction" | "distance") => active ? group.reduce((sum, value) => sum + value[key], 0) / active : 0;
    return {
      startMs: group[0].startMs,
      endMs: group[group.length - 1].endMs,
      pattern,
      averageStrain: roundRating(average("strain")),
      peakStrain: roundRating(Math.max(...group.map((value) => value.peak))),
      averageNps: roundRating(average("nps")),
      jumpness: roundRating(average("jumpness")),
      direction: roundRating(average("direction")),
      distance: roundRating(average("distance")),
    };
  });
}

export function analyzeMapNotes(notes: MapNote[]): MapDifficultyAnalysis {
  const clean = notes.filter((note) => Number.isFinite(note.time) && Number.isFinite(note.x) && Number.isFinite(note.y)).sort((a, b) => a.time - b.time);
  if (clean.length < MIN_ANALYSIS_NOTES) throw new Error(`Map needs at least ${MIN_ANALYSIS_NOTES} valid notes for difficulty analysis.`);
  const base = analyzeAtSpeed(clean, 1);
  const directionScore = roundRating(clamp(percentile(base.transitions.map((value) => value.direction), 0.9) * 10, 0, 10));
  const distanceScore = roundRating(clamp(percentile(base.transitions.map((value) => value.distance), 0.9) * 10, 0, 10));
  const npsScore = roundRating(clamp(percentile(base.transitions.map((value) => value.nps), 0.9) / 1.8, 0, 10));
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
  const topSections = [...base.sections].sort((a, b) => b.strain - a.strain).slice(0, 8).map((section) => ({ ...section, strain: roundRating(section.strain), nps: roundRating(section.nps), jumpness: roundRating(section.jumpness), direction: roundRating(section.direction), distance: roundRating(section.distance) }));
  const patternSegments = buildPatternSegments(base.sections, Math.max(clean[clean.length - 1].time, 1500));
  return { version: MAP_ANALYZER_VERSION, rating: base.rating, directionScore, distanceScore, npsScore, staminaIndex: roundRating(base.staminaIndex), activeDurationMs: base.activeDurationMs, longestHardSectionMs: base.longestHardSectionMs, peakJumpNps, peakStreamNps, peakJumpStrain, peakStreamStrain, jumpRatio, noteCount: clean.length, rewards, speedProfiles, topSections, patternSegments };
}

export function analyzeMapBytes(data: Uint8Array) { return analyzeMapNotes(parseMapNotes(data)); }

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
  return { speed: roundRating(speed), rating: roundRating(interpolate(lower.rating, upper.rating)), rewards: { lock: Math.round(interpolate(lower.rewards.lock, upper.rewards.lock)), vr: Math.round(interpolate(lower.rewards.vr, upper.rewards.vr)), spin: Math.round(interpolate(lower.rewards.spin, upper.rewards.spin)) } };
}
