import { prisma } from "@/lib/db";
import { rhythiaRequest } from "@/lib/rhythia";
import { parseMapNotes, type MapNote, type MapPatternSegment } from "@/lib/map-difficulty";
import { parseSspmV1Notes } from "@/lib/legacy-map-analysis";
import { resolveRhythiaMapSource } from "@/lib/rhythia-map-source";
import type { ModeKey } from "@/lib/rhythia-mode-rules";

const MAX_REPLAY_BYTES = 48 * 1024 * 1024;
const MAX_MAP_BYTES = 64 * 1024 * 1024;
const MAX_FRAMES = 3_000_000;
const RETRY_UNAVAILABLE_MS = 20 * 60 * 1000;
const MAX_REPLAY_ANALYSES_PER_SYNC = 4;
const RHR_EXTENDED = 20260125;
const RHR_FAIL_TIME = 20260222;
const RHR_INT_TIME = 20260510;
const RHR_HASH = 20260517;
const RHR_NEGATE_Y = 20260118;

type JsonRecord = Record<string, unknown>;
type StoredModeScore = { id: string; mapKey: string; mapTitle: string; scoreId: number; cameraMode: ModeKey; points: number; accuracy: number | null; awardedSp: number | null; speed: number | null };
type ScoreCandidate = { id: number; value: JsonRecord; recent: boolean; createdAt: number };
type PassCache = {
  userId: string;
  scoreId: number;
  cameraMode: string;
  mapKey: string;
  mapTitle: string;
  mapperName: string | null;
  basePoints: number;
  balanceMultiplier: number;
  balanceScore: number | null;
  adjustedPoints: number;
  status: string;
  mapVerified: boolean;
  confidence: number | null;
  replayUrl: string | null;
  analysis: unknown;
  error: string | null;
  checkedAt: Date;
};
type MapContext = {
  id: string;
  title: string;
  mapperName: string | null;
  sourceBeatmapId: number | null;
  mapFileUrl: string;
  sourceStatus: string;
  patternSegments: unknown;
};
type ReplayFrame = { time: number; x: number; y: number; health: number; important: boolean };
type ReplayData = {
  version: number;
  playerName: string;
  legacyMapId: string;
  mapId: number;
  startFrom: number;
  mode: string;
  passed: boolean;
  spin: boolean;
  speed: number;
  accuracy: number;
  hits: number;
  misses: number;
  beatmapHash: string;
  frames: ReplayFrame[];
};
type PatternKey = "stream" | "jump" | "tech" | "mixed";
type PatternStat = { pattern: PatternKey; notes: number; misses: number; accuracy: number; smoothedAccuracy: number; share: number; missShare: number };
type SectionStat = { startMs: number; endMs: number; pattern: PatternKey; notes: number; misses: number; accuracy: number };

class ReplayReader {
  private offset = 0;
  private view: DataView;
  private bytes: Uint8Array;
  constructor(bytes: Uint8Array) { this.bytes = bytes; this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); }
  private need(length: number) { if (length < 0 || this.offset + length > this.bytes.byteLength) throw new Error("Replay file is truncated."); }
  u8() { this.need(1); return this.bytes[this.offset++]; }
  i32() { this.need(4); const value = this.view.getInt32(this.offset, true); this.offset += 4; return value; }
  i64() { this.need(8); const value = this.view.getBigInt64(this.offset, true); this.offset += 8; return value; }
  f32() { this.need(4); const value = this.view.getFloat32(this.offset, true); this.offset += 4; return value; }
  bool() { return this.u8() !== 0; }
  string() {
    let length = 0;
    let shift = 0;
    for (let index = 0; index < 5; index += 1) {
      const byte = this.u8();
      length |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) {
        if (length < 0 || length > 16 * 1024 * 1024) throw new Error("Replay string is too large.");
        this.need(length);
        const value = new TextDecoder().decode(this.bytes.subarray(this.offset, this.offset + length));
        this.offset += length;
        return value;
      }
      shift += 7;
    }
    throw new Error("Replay string length is invalid.");
  }
}

function clamp(value: number, min = 0, max = 1) { return Math.min(max, Math.max(min, value)); }
function round(value: number, digits = 3) { const scale = 10 ** digits; return Math.round(value * scale) / scale; }
function normalize(value: unknown) { return typeof value === "string" ? value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim() : ""; }
function normalizeSourceId(value: number) { return Number.isSafeInteger(value) && value > 0x7fffffff && value <= 0xffffffff ? value - 0x100000000 : value; }
function numberField(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}
function stringField(record: JsonRecord, keys: string[]) {
  for (const key of keys) if (typeof record[key] === "string" && (record[key] as string).trim()) return (record[key] as string).trim();
  return null;
}
function booleanField(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
    if (value === 1 || value === "1" || value === "true") return true;
    if (value === 0 || value === "0" || value === "false") return false;
  }
  return null;
}
function scoreId(record: JsonRecord) { const value = numberField(record, ["id", "scoreId", "score_id"]); return value != null && Number.isInteger(value) && value > 0 ? value : null; }
function scoreCreatedAt(record: JsonRecord) {
  const raw = record.created_at ?? record.createdAt ?? record.timestamp ?? record.date;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw > 10_000_000_000 ? raw : raw * 1000;
  if (typeof raw === "string") { const value = Date.parse(raw); return Number.isFinite(value) ? value : 0; }
  return 0;
}
function scoreAccuracy(record: JsonRecord) {
  const direct = numberField(record, ["accuracy", "acc"]);
  if (direct != null) return clamp(direct > 1 ? direct / 100 : direct);
  const notes = numberField(record, ["beatmapNotes", "beatmap_notes", "notes"]);
  const misses = numberField(record, ["misses", "miss"]);
  return notes && notes > 0 && misses != null ? clamp((notes - misses) / notes) : null;
}
function scoreReplayUrl(record: JsonRecord) {
  const direct = stringField(record, ["replay_url", "replayUrl", "replayURL", "replay", "replay_file", "replayFile", "replay_download_url", "replayDownloadUrl"]);
  if (direct) return direct;
  for (const [key, value] of Object.entries(record)) {
    if (!/replay/i.test(key)) continue;
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = scoreReplayUrl(value as JsonRecord);
      if (nested) return nested;
    }
  }
  return null;
}
function isScoreLike(record: JsonRecord) {
  return scoreId(record) != null && ("passed" in record || "misses" in record || "beatmapTitle" in record || "beatmapHash" in record || "replay_url" in record);
}
function collectScores(value: unknown, path: string[] = [], out: ScoreCandidate[] = []) {
  if (!value || typeof value !== "object") return out;
  if (Array.isArray(value)) {
    for (const item of value) collectScores(item, path, out);
    return out;
  }
  const record = value as JsonRecord;
  if (isScoreLike(record)) {
    const id = scoreId(record)!;
    const key = path.join(".").toLowerCase();
    out.push({ id, value: record, recent: /lastday|recent|latest|profile.*score|scores.*recent/.test(key), createdAt: scoreCreatedAt(record) });
  }
  if (path.length >= 6) return out;
  for (const [key, item] of Object.entries(record)) if (item && typeof item === "object") collectScores(item, [...path, key], out);
  return out;
}
function mergeScoreCandidates(values: ScoreCandidate[]) {
  const byId = new Map<number, ScoreCandidate>();
  for (const candidate of values) {
    const old = byId.get(candidate.id);
    if (!old) { byId.set(candidate.id, candidate); continue; }
    const oldReplay = scoreReplayUrl(old.value);
    const nextReplay = scoreReplayUrl(candidate.value);
    const oldFields = Object.keys(old.value).length;
    const nextFields = Object.keys(candidate.value).length;
    if ((!oldReplay && nextReplay) || candidate.recent && !old.recent || nextFields > oldFields) byId.set(candidate.id, { ...candidate, recent: old.recent || candidate.recent, createdAt: Math.max(old.createdAt, candidate.createdAt) });
    else if (candidate.recent && !old.recent) old.recent = true;
  }
  return byId;
}

export function parseRhythiaReplay(bytes: Uint8Array): ReplayData {
  if (!bytes.byteLength || bytes.byteLength > MAX_REPLAY_BYTES) throw new Error("Replay file size is invalid.");
  const reader = new ReplayReader(bytes);
  const version = reader.i32();
  if (version < 20200101 || version > 21000101) throw new Error("Replay version is not recognized.");
  reader.i64();
  const playerName = reader.string();
  const legacyMapId = reader.string();
  const mapId = reader.i32();
  const startFrom = reader.i32();
  const mode = reader.string();
  let passed = true;
  let spin = false;
  let speed = 1;
  if (version >= RHR_EXTENDED) {
    passed = reader.bool();
    reader.string();
    spin = reader.bool();
    speed = reader.f32();
    reader.i64();
  }
  const accuracy = reader.f32();
  const hits = reader.i32();
  const misses = reader.i32();
  reader.f32();
  if (version >= RHR_FAIL_TIME) reader.i32();
  const beatmapHash = version >= RHR_HASH ? reader.string() : "";
  const frameCount = reader.i32();
  if (!Number.isInteger(frameCount) || frameCount < 0 || frameCount > MAX_FRAMES) throw new Error("Replay frame count is invalid.");
  const frames: ReplayFrame[] = [];
  for (let index = 0; index < frameCount; index += 1) {
    const time = version >= RHR_INT_TIME ? reader.i32() : Math.round(reader.f32());
    const x = reader.f32();
    let y = reader.f32();
    const health = reader.f32();
    const important = reader.u8() !== 0;
    if (version < RHR_NEGATE_Y) y = -y;
    if (Number.isFinite(time) && Number.isFinite(x) && Number.isFinite(y)) frames.push({ time, x, y, health, important });
  }
  if (frames.length < 2) throw new Error("Replay contains too few usable frames.");
  frames.sort((a, b) => a.time - b.time);
  return { version, playerName, legacyMapId, mapId, startFrom, mode, passed, spin, speed: Number.isFinite(speed) && speed > 0 ? speed : 1, accuracy: clamp(Number.isFinite(accuracy) ? accuracy > 1 ? accuracy / 100 : accuracy : 0), hits: Math.max(0, hits), misses: Math.max(0, misses), beatmapHash, frames };
}

function officialUrl(value: string, base = "https://production.rhythia.com") {
  try {
    const url = new URL(value, base);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || !(host === "rhythia.com" || host.endsWith(".rhythia.com"))) return null;
    return url.toString();
  } catch { return null; }
}
async function fetchBinary(url: string, maximum: number, accept: string) {
  const safe = officialUrl(url);
  if (!safe) throw new Error("Replay or map URL is not an official Rhythia URL.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(safe, { cache: "no-store", redirect: "follow", signal: controller.signal, headers: { accept, "user-agent": "Rhythians-Ranking/7.0" } });
    if (!response.ok) throw new Error(`Rhythia file download returned HTTP ${response.status}.`);
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > maximum) throw new Error("Rhythia file is too large to process safely.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.byteLength || bytes.byteLength > maximum) throw new Error("Rhythia file size is invalid.");
    return bytes;
  } finally { clearTimeout(timeout); }
}
async function replayMetadata(score: JsonRecord) {
  const direct = scoreReplayUrl(score);
  if (direct) return direct;
  const id = scoreId(score);
  if (!id) return null;
  for (const path of ["getScore", "getScoreInfo"] as const) {
    try {
      const response = await rhythiaRequest<unknown>(path, { id, scoreId: id });
      const candidates = collectScores(response);
      for (const candidate of candidates) { const replay = scoreReplayUrl(candidate.value); if (replay) return replay; }
      if (response && typeof response === "object" && !Array.isArray(response)) {
        const replay = scoreReplayUrl(response as JsonRecord);
        if (replay) return replay;
      }
    } catch {}
  }
  return null;
}
function parseSegments(value: unknown): MapPatternSegment[] {
  if (Array.isArray(value)) return value as MapPatternSegment[];
  if (typeof value === "string") { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed as MapPatternSegment[] : []; } catch { return []; } }
  return [];
}
function patternForSegment(segment: MapPatternSegment | undefined): PatternKey {
  if (!segment) return "mixed";
  if (segment.pattern === "jump" || segment.pattern === "jump-lean") return segment.direction >= 0.58 && segment.averageNps >= 3.5 && segment.distance >= 0.12 ? "tech" : "jump";
  if (segment.pattern === "stream" || segment.pattern === "stream-lean") return segment.direction >= 0.62 && segment.averageNps >= 3.8 && segment.distance >= 0.12 ? "tech" : "stream";
  if (segment.direction >= 0.55 && segment.averageNps >= 3.5 && segment.distance >= 0.12) return "tech";
  return "mixed";
}
function segmentForTime(segments: MapPatternSegment[], time: number) {
  let low = 0;
  let high = segments.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const segment = segments[middle];
    if (time < segment.startMs) high = middle - 1;
    else if (time >= segment.endMs) low = middle + 1;
    else return segment;
  }
  return undefined;
}
function lowerBoundFrame(frames: ReplayFrame[], time: number) {
  let low = 0;
  let high = frames.length;
  while (low < high) { const middle = (low + high) >> 1; if (frames[middle].time < time) low = middle + 1; else high = middle; }
  return low;
}
type CoordinateTransform = { name: string; point: (note: MapNote) => [number, number] };
type TimeTransform = { name: string; time: (note: MapNote, replay: ReplayData) => number };
const coordinateTransforms: CoordinateTransform[] = [
  { name: "center-1.5", point: (note) => [note.x - 1.5, note.y - 1.5] },
  { name: "center-1.5-flip-y", point: (note) => [note.x - 1.5, 1.5 - note.y] },
  { name: "raw", point: (note) => [note.x, note.y] },
  { name: "raw-flip-y", point: (note) => [note.x, -note.y] },
  { name: "center-2", point: (note) => [note.x - 2, note.y - 2] },
  { name: "center-2-flip-y", point: (note) => [note.x - 2, 2 - note.y] },
];
const timeTransforms: TimeTransform[] = [
  { name: "map-time", time: (note, replay) => note.time - replay.startFrom },
  { name: "elapsed-speed", time: (note, replay) => (note.time - replay.startFrom) / Math.max(0.1, replay.speed) },
  { name: "scaled-map-time", time: (note, replay) => note.time / Math.max(0.1, replay.speed) - replay.startFrom },
];
function noteCursorError(note: MapNote, replay: ReplayData, coordinate: CoordinateTransform, timing: TimeTransform) {
  const time = timing.time(note, replay);
  const [x, y] = coordinate.point(note);
  const start = lowerBoundFrame(replay.frames, time - 115);
  let min = Number.POSITIVE_INFINITY;
  let important = Number.POSITIVE_INFINITY;
  let seen = false;
  for (let index = start; index < replay.frames.length; index += 1) {
    const frame = replay.frames[index];
    if (frame.time > time + 115) break;
    seen = true;
    const distance = Math.hypot(frame.x - x, frame.y - y);
    if (distance < min) min = distance;
    if (frame.important && distance < important) important = distance;
  }
  if (!seen) return 10;
  return Number.isFinite(important) ? important * 0.72 + min * 0.28 : min + 0.28;
}
function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
function chooseReplayTransform(notes: MapNote[], replay: ReplayData) {
  const candidates: Array<{ coordinate: CoordinateTransform; timing: TimeTransform; medianError: number; coverage: number }> = [];
  const sampleStep = Math.max(1, Math.floor(notes.length / 160));
  const sample = notes.filter((_, index) => index % sampleStep === 0).slice(0, 180);
  for (const coordinate of coordinateTransforms) for (const timing of timeTransforms) {
    const errors = sample.map((note) => noteCursorError(note, replay, coordinate, timing));
    const covered = errors.filter((error) => error < 9).length;
    candidates.push({ coordinate, timing, medianError: median(errors.filter((error) => error < 9)), coverage: sample.length ? covered / sample.length : 0 });
  }
  candidates.sort((a, b) => (b.coverage - a.coverage) || (a.medianError - b.medianError));
  return candidates[0];
}
function verifyReplay(replay: ReplayData, score: JsonRecord, map: MapContext) {
  const mapIdMatches = map.sourceBeatmapId != null && normalizeSourceId(replay.mapId) === normalizeSourceId(map.sourceBeatmapId);
  const scoreHash = normalize(stringField(score, ["beatmapHash", "beatmap_hash", "songId", "song_id"]));
  const replayLegacy = normalize(replay.legacyMapId);
  const replayHash = normalize(replay.beatmapHash);
  const title = normalize(stringField(score, ["beatmapTitle", "beatmap_title", "title"]));
  const titleMatches = !title || title === normalize(map.title);
  const legacyMatches = Boolean(scoreHash && (scoreHash === replayLegacy || scoreHash === replayHash));
  if (mapIdMatches) return { verified: true, confidence: replay.beatmapHash ? 1 : 0.93, method: replay.beatmapHash ? "map-id+replay-hash" : "map-id" };
  if (legacyMatches && titleMatches) return { verified: true, confidence: replay.beatmapHash ? 0.9 : 0.8, method: "legacy-id+title" };
  return { verified: false, confidence: 0, method: "identity-mismatch" };
}
function parseMapData(bytes: Uint8Array) {
  try { return parseMapNotes(bytes); }
  catch (error) {
    const buffer = Buffer.from(bytes);
    if (buffer.length >= 6 && buffer.readUInt32LE(0) === 0x6d2b5353 && buffer.readUInt16LE(4) === 1) return parseSspmV1Notes(bytes);
    throw error;
  }
}
async function mapBytes(map: MapContext) {
  let url = officialUrl(map.mapFileUrl);
  if (map.sourceBeatmapId != null) {
    const resolved = await resolveRhythiaMapSource(map.sourceBeatmapId).catch(() => null);
    url = officialUrl(resolved?.mapFileUrl ?? "") ?? url;
  }
  if (!url) throw new Error("The exact official Rhythia map file could not be resolved.");
  return fetchBinary(url, MAX_MAP_BYTES, "application/octet-stream,application/zip,application/json;q=0.9,*/*;q=0.1");
}
function buildBalance(notes: MapNote[], replay: ReplayData, segments: MapPatternSegment[], confidence: number) {
  if (replay.misses <= 0) return { multiplier: 1, balanceScore: 100, confidence, patterns: [] as PatternStat[], sections: [] as SectionStat[], transform: null, inferredMisses: [] as number[] };
  const transform = chooseReplayTransform(notes, replay);
  const usableNotes = notes.filter((note) => note.time >= replay.startFrom);
  const expectedTotal = replay.hits + replay.misses;
  const countGap = expectedTotal > 0 ? Math.abs(usableNotes.length - expectedTotal) / Math.max(expectedTotal, usableNotes.length) : 0;
  const transformConfidence = clamp((transform.coverage - 0.65) / 0.35) * clamp((1.4 - transform.medianError) / 1.15) * clamp((0.25 - countGap) / 0.25);
  const combinedConfidence = clamp(confidence * transformConfidence);
  if (combinedConfidence < 0.42) throw new Error(`Replay-to-map alignment confidence was too low (${round(combinedConfidence, 2)}).`);
  const scored = usableNotes.map((note, index) => ({ index, note, error: noteCursorError(note, replay, transform.coordinate, transform.timing) }));
  scored.sort((a, b) => b.error - a.error);
  const missCount = Math.min(Math.max(0, replay.misses), scored.length);
  const misses = new Set(scored.slice(0, missCount).map((entry) => entry.index));
  const totals = new Map<PatternKey, { notes: number; misses: number }>();
  const sectionTotals = new Map<string, { segment: MapPatternSegment; pattern: PatternKey; notes: number; misses: number }>();
  usableNotes.forEach((note, index) => {
    const segment = segmentForTime(segments, note.time);
    if (!segment || segment.pattern === "rest") return;
    const pattern = patternForSegment(segment);
    const total = totals.get(pattern) ?? { notes: 0, misses: 0 };
    total.notes += 1;
    if (misses.has(index)) total.misses += 1;
    totals.set(pattern, total);
    const sectionKey = `${segment.startMs}:${segment.endMs}`;
    const section = sectionTotals.get(sectionKey) ?? { segment, pattern, notes: 0, misses: 0 };
    section.notes += 1;
    if (misses.has(index)) section.misses += 1;
    sectionTotals.set(sectionKey, section);
  });
  const activeNotes = [...totals.values()].reduce((sum, value) => sum + value.notes, 0);
  const activeMisses = [...totals.values()].reduce((sum, value) => sum + value.misses, 0);
  const globalAccuracy = activeNotes ? 1 - activeMisses / activeNotes : clamp(replay.accuracy);
  const prior = 8;
  const patterns: PatternStat[] = [...totals.entries()].map(([pattern, value]) => {
    const accuracy = value.notes ? 1 - value.misses / value.notes : 1;
    const smoothedAccuracy = (accuracy * value.notes + globalAccuracy * prior) / (value.notes + prior);
    return { pattern, notes: value.notes, misses: value.misses, accuracy: round(accuracy, 4), smoothedAccuracy: round(smoothedAccuracy, 4), share: round(value.notes / Math.max(1, activeNotes), 4), missShare: round(value.misses / Math.max(1, activeMisses), 4) };
  }).sort((a, b) => b.notes - a.notes);
  const minimumNotes = Math.max(6, Math.ceil(activeNotes * 0.04));
  const meaningful = patterns.filter((pattern) => pattern.notes >= minimumNotes);
  const sections: SectionStat[] = [...sectionTotals.values()].map((value) => ({ startMs: value.segment.startMs, endMs: value.segment.endMs, pattern: value.pattern, notes: value.notes, misses: value.misses, accuracy: round(value.notes ? 1 - value.misses / value.notes : 1, 4) })).filter((section) => section.notes >= 3).sort((a, b) => a.startMs - b.startMs);
  if (meaningful.length < 2 || activeMisses <= 0) return { multiplier: 1, balanceScore: 100, confidence: combinedConfidence, patterns, sections, transform: { coordinate: transform.coordinate.name, timing: transform.timing.name, medianError: round(transform.medianError), coverage: round(transform.coverage) }, inferredMisses: [...misses] };
  const weights = meaningful.map((pattern) => pattern.notes / meaningful.reduce((sum, item) => sum + item.notes, 0));
  const meanAccuracy = meaningful.reduce((sum, pattern, index) => sum + pattern.smoothedAccuracy * weights[index], 0);
  const variance = meaningful.reduce((sum, pattern, index) => sum + (pattern.smoothedAccuracy - meanAccuracy) ** 2 * weights[index], 0);
  const standardDeviation = Math.sqrt(variance);
  const weakest = Math.min(...meaningful.map((pattern) => pattern.smoothedAccuracy));
  const strongest = Math.max(...meaningful.map((pattern) => pattern.smoothedAccuracy));
  const concentration = Math.max(0, ...meaningful.map((pattern) => pattern.missShare - pattern.share));
  const weakestGap = Math.max(0, globalAccuracy - weakest);
  const sectionCandidates = sections.filter((section) => section.notes >= minimumNotes);
  const sectionConcentration = sectionCandidates.length && activeMisses ? Math.max(0, ...sectionCandidates.map((section) => section.misses / activeMisses - section.notes / Math.max(1, activeNotes))) : 0;
  const evidence = clamp(activeMisses / Math.max(4, activeNotes * 0.02));
  let severity = 0.32 * clamp(standardDeviation / 0.12) + 0.28 * clamp(weakestGap / 0.18) + 0.22 * clamp(concentration / 0.55) + 0.1 * clamp((strongest - weakest) / 0.24) + 0.08 * clamp(sectionConcentration / 0.5);
  severity = clamp(severity * evidence * (0.72 + 0.28 * combinedConfidence));
  const multiplier = round(Math.max(0.7, 1 - 0.3 * severity), 3);
  return { multiplier, balanceScore: round((1 - severity) * 100, 1), confidence: combinedConfidence, patterns, sections, transform: { coordinate: transform.coordinate.name, timing: transform.timing.name, medianError: round(transform.medianError), coverage: round(transform.coverage) }, inferredMisses: [...misses] };
}
async function mapForScore(row: StoredModeScore): Promise<MapContext | null> {
  const sourceMatch = row.mapKey.match(/^rhythia:(-?\d+)$/);
  const mapMatch = row.mapKey.match(/^map:(.+)$/);
  const rows = sourceMatch
    ? await prisma.$queryRawUnsafe<MapContext[]>(`SELECT c.id,c.title,c."mapperName",c."sourceBeatmapId",c."mapFileUrl",a."sourceStatus",a."patternSegments" FROM "ChallengeMap" c JOIN "MapDifficultyAnalysis" a ON a."mapId"=c.id WHERE c."sourceBeatmapId"=$1 AND c.status IN ('approved','legacy') AND a."sourceStatus" IN ('ranked','legacy') AND a.status='analyzed' AND a."pointEligible"=TRUE LIMIT 1`, Number(sourceMatch[1]))
    : mapMatch ? await prisma.$queryRawUnsafe<MapContext[]>(`SELECT c.id,c.title,c."mapperName",c."sourceBeatmapId",c."mapFileUrl",a."sourceStatus",a."patternSegments" FROM "ChallengeMap" c JOIN "MapDifficultyAnalysis" a ON a."mapId"=c.id WHERE c.id=$1 AND c.status IN ('approved','legacy') AND a."sourceStatus" IN ('ranked','legacy') AND a.status='analyzed' AND a."pointEligible"=TRUE LIMIT 1`, mapMatch[1]) : [];
  return rows[0] ?? null;
}
async function cached(userId: string, row: StoredModeScore) {
  const rows = await prisma.$queryRawUnsafe<PassCache[]>(`SELECT * FROM "RhythiaPassAnalysis" WHERE "userId"=$1 AND "scoreId"=$2 AND "cameraMode"=$3 LIMIT 1`, userId, row.scoreId, row.cameraMode);
  return rows[0] ?? null;
}
async function saveCache(userId: string, row: StoredModeScore, map: MapContext, data: Partial<PassCache> & { status: string; basePoints: number; adjustedPoints: number; balanceMultiplier: number }) {
  await prisma.$executeRawUnsafe(`INSERT INTO "RhythiaPassAnalysis" ("userId","scoreId","cameraMode","mapKey","mapTitle","mapperName","basePoints","balanceMultiplier","balanceScore","adjustedPoints","status","mapVerified","confidence","replayUrl","analysis","error","checkedAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT ("userId","scoreId","cameraMode") DO UPDATE SET "mapKey"=EXCLUDED."mapKey","mapTitle"=EXCLUDED."mapTitle","mapperName"=EXCLUDED."mapperName","basePoints"=EXCLUDED."basePoints","balanceMultiplier"=EXCLUDED."balanceMultiplier","balanceScore"=EXCLUDED."balanceScore","adjustedPoints"=EXCLUDED."adjustedPoints","status"=EXCLUDED."status","mapVerified"=EXCLUDED."mapVerified","confidence"=EXCLUDED."confidence","replayUrl"=EXCLUDED."replayUrl","analysis"=EXCLUDED."analysis","error"=EXCLUDED."error","checkedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP`, userId, row.scoreId, row.cameraMode, row.mapKey, map.title, map.mapperName, data.basePoints, data.balanceMultiplier, data.balanceScore ?? null, data.adjustedPoints, data.status, data.mapVerified ?? false, data.confidence ?? null, data.replayUrl ?? null, JSON.stringify(data.analysis ?? null), data.error ?? null);
}
async function applyCachedPoints(row: StoredModeScore, cache: PassCache) {
  if (cache.status !== "analyzed") return false;
  const base = row.points === cache.adjustedPoints ? cache.basePoints : row.points;
  const adjusted = Math.max(0, Math.round(base * clamp(cache.balanceMultiplier, 0.7, 1)));
  if (base !== cache.basePoints || adjusted !== cache.adjustedPoints) await prisma.$executeRawUnsafe(`UPDATE "RhythiaPassAnalysis" SET "basePoints"=$4,"adjustedPoints"=$5,"updatedAt"=CURRENT_TIMESTAMP WHERE "userId"=$1 AND "scoreId"=$2 AND "cameraMode"=$3`, cache.userId, cache.scoreId, cache.cameraMode, base, adjusted);
  if (row.points !== adjusted) await prisma.rhythiaModeScore.update({ where: { id: row.id }, data: { points: adjusted } });
  return row.points !== adjusted;
}
async function analyzeRow(userId: string, row: StoredModeScore, score: ScoreCandidate, map: MapContext) {
  const replayValue = await replayMetadata(score.value);
  if (!replayValue) {
    await saveCache(userId, row, map, { status: "unavailable", basePoints: row.points, adjustedPoints: row.points, balanceMultiplier: 1, error: "Rhythia did not provide a replay URL for this score." });
    return { status: "unavailable", adjusted: false } as const;
  }
  const replayUrl = officialUrl(replayValue);
  if (!replayUrl) {
    await saveCache(userId, row, map, { status: "invalid", basePoints: row.points, adjustedPoints: row.points, balanceMultiplier: 1, replayUrl: replayValue, error: "Replay URL was not an official Rhythia URL." });
    return { status: "invalid", adjusted: false } as const;
  }
  try {
    const [replayBytes, exactMapBytes] = await Promise.all([
      fetchBinary(replayUrl, MAX_REPLAY_BYTES, "application/octet-stream,*/*;q=0.1"),
      mapBytes(map),
    ]);
    const replay = parseRhythiaReplay(replayBytes);
    if (!replay.passed) throw new Error("Replay is not a passing run.");
    const identity = verifyReplay(replay, score.value, map);
    if (!identity.verified) throw new Error("Replay did not match the exact analyzed map identity.");
    const notes = parseMapData(exactMapBytes);
    const segments = parseSegments(map.patternSegments).sort((a, b) => a.startMs - b.startMs);
    if (segments.length < 1) throw new Error("Map has no stored pattern timeline for pass analysis.");
    const scoreMisses = numberField(score.value, ["misses", "miss"]);
    const scoreNotes = numberField(score.value, ["beatmapNotes", "beatmap_notes", "notes"]);
    if (scoreMisses != null && Math.abs(scoreMisses - replay.misses) > Math.max(2, Math.ceil(replay.misses * 0.2))) throw new Error("Replay miss count did not match the Rhythia score.");
    if (scoreNotes != null && Math.abs(scoreNotes - notes.length) > Math.max(5, Math.ceil(notes.length * 0.03))) throw new Error("Replay score note count did not match the analyzed map file.");
    const balance = buildBalance(notes, replay, segments, identity.confidence);
    const adjustedPoints = Math.max(1, Math.round(row.points * balance.multiplier));
    const analysis = {
      version: 1,
      scoreId: row.scoreId,
      source: score.recent ? "profile-recent" : "profile-history",
      map: { id: map.id, sourceBeatmapId: map.sourceBeatmapId, title: map.title, mapperName: map.mapperName, sourceStatus: map.sourceStatus },
      score: { beatmapTitle: stringField(score.value, ["beatmapTitle", "beatmap_title", "title"]), beatmapHash: stringField(score.value, ["beatmapHash", "beatmap_hash"]), songId: stringField(score.value, ["songId", "song_id"]), accuracy: scoreAccuracy(score.value), misses: scoreMisses, notes: scoreNotes, speed: numberField(score.value, ["speed"]) },
      replay: { version: replay.version, playerName: replay.playerName, legacyMapId: replay.legacyMapId, mapId: replay.mapId, beatmapHash: replay.beatmapHash, hits: replay.hits, misses: replay.misses, accuracy: replay.accuracy, speed: replay.speed, frames: replay.frames.length, identityMethod: identity.method },
      alignment: balance.transform,
      patterns: balance.patterns,
      sections: balance.sections,
      balanceScore: balance.balanceScore,
      balanceMultiplier: balance.multiplier,
      confidence: round(balance.confidence, 3),
    };
    await saveCache(userId, row, map, { status: "analyzed", basePoints: row.points, adjustedPoints, balanceMultiplier: balance.multiplier, balanceScore: balance.balanceScore, mapVerified: true, confidence: balance.confidence, replayUrl, analysis });
    if (adjustedPoints !== row.points) await prisma.rhythiaModeScore.update({ where: { id: row.id }, data: { points: adjustedPoints } });
    return { status: "analyzed", adjusted: adjustedPoints !== row.points, multiplier: balance.multiplier, balanceScore: balance.balanceScore } as const;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Replay analysis failed.";
    await saveCache(userId, row, map, { status: "error", basePoints: row.points, adjustedPoints: row.points, balanceMultiplier: 1, replayUrl, error: message });
    return { status: "error", adjusted: false, error: message } as const;
  }
}

export async function applyRecentPassBalance(userId: string, maxAnalyses = MAX_REPLAY_ANALYSES_PER_SYNC) {
  const [profile, rows] = await Promise.all([
    prisma.rhythiaProfile.findUnique({ where: { userId }, select: { profileId: true } }),
    prisma.rhythiaModeScore.findMany({ where: { userId }, select: { id: true, mapKey: true, mapTitle: true, scoreId: true, cameraMode: true, points: true, accuracy: true, awardedSp: true, speed: true } }),
  ]);
  if (!profile || !rows.length) return { checked: 0, analyzed: 0, adjusted: 0, unavailable: 0, errors: 0 };
  const [profileResult, scoresResult] = await Promise.allSettled([
    rhythiaRequest<unknown>("getProfile", { id: profile.profileId }),
    rhythiaRequest<unknown>("getUserScores", { id: profile.profileId, limit: 250 }),
  ]);
  const discovered = mergeScoreCandidates([
    ...(profileResult.status === "fulfilled" ? collectScores(profileResult.value, ["profile"]) : []),
    ...(scoresResult.status === "fulfilled" ? collectScores(scoresResult.value, ["scores"]) : []),
  ]);
  const ordered = (rows as StoredModeScore[]).map((row) => ({ row, score: discovered.get(row.scoreId) ?? null })).sort((a, b) => Number(Boolean(b.score?.recent)) - Number(Boolean(a.score?.recent)) || (b.score?.createdAt ?? 0) - (a.score?.createdAt ?? 0));
  let checked = 0;
  let analyzed = 0;
  let adjusted = 0;
  let unavailable = 0;
  let errors = 0;
  let newAnalyses = 0;
  for (const entry of ordered) {
    if (!entry.score) continue;
    const cache = await cached(userId, entry.row);
    if (cache?.status === "analyzed") {
      checked += 1;
      if (await applyCachedPoints(entry.row, cache)) adjusted += 1;
      continue;
    }
    const retryDue = !cache || Date.now() - new Date(cache.checkedAt).getTime() >= RETRY_UNAVAILABLE_MS;
    if (!retryDue || newAnalyses >= Math.max(0, maxAnalyses) || !entry.score.recent) continue;
    const map = await mapForScore(entry.row);
    if (!map) continue;
    checked += 1;
    newAnalyses += 1;
    const result = await analyzeRow(userId, entry.row, entry.score, map);
    if (result.status === "analyzed") { analyzed += 1; if (result.adjusted) adjusted += 1; }
    else if (result.status === "unavailable") unavailable += 1;
    else errors += 1;
  }
  return { checked, analyzed, adjusted, unavailable, errors };
}
