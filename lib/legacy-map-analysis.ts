import { prisma } from "@/lib/db";
import { analyzeMapNotes, MAP_ANALYZER_VERSION, type MapDifficultyAnalysis, type MapNote } from "@/lib/map-difficulty";
import { analyzeMapRankability, type MapRankabilityAnalysis } from "@/lib/map-rankability";
import { analyzeChallengeMap, markMapAnalysisFailed, saveMapAnalysis } from "@/lib/map-analysis-store";

const MAX_MAP_BYTES = 64 * 1024 * 1024;
const MAX_NOTE_BYTES = 64 * 1024 * 1024;
const INITIAL_HEADER_BYTES = 64 * 1024;

type LegacyAnalysisBundle = { analysis: MapDifficultyAnalysis; rankability: MapRankabilityAnalysis };

function readLine(buffer: Buffer, cursor: number) {
  const end = buffer.indexOf(0x0a, cursor);
  if (end < 0) throw new Error("Invalid SSPM v1 metadata.");
  return end + 1;
}

function parseV1Header(buffer: Buffer) {
  if (buffer.length < 8 || buffer.readUInt32LE(0) !== 0x6d2b5353 || buffer.readUInt16LE(4) !== 1) throw new Error("Legacy map is not a supported SSPM v1 file.");
  let cursor = 8;
  cursor = readLine(buffer, cursor);
  cursor = readLine(buffer, cursor);
  cursor = readLine(buffer, cursor);
  if (cursor + 10 > buffer.length) throw new Error("SSPM v1 metadata is incomplete.");
  cursor += 4;
  const noteCount = buffer.readUInt32LE(cursor);
  cursor += 4;
  cursor += 1;
  const coverType = buffer[cursor++];
  if (coverType === 2) {
    if (cursor + 8 > buffer.length) throw new Error("SSPM v1 cover metadata is incomplete.");
    const length = Number(buffer.readBigUInt64LE(cursor));
    if (!Number.isSafeInteger(length) || length < 0) throw new Error("Invalid SSPM v1 cover length.");
    cursor += 8 + length;
  } else if (coverType !== 0 && coverType !== 1) throw new Error("Unsupported SSPM v1 cover type.");
  return { noteCount, audioOffset: cursor };
}

function parseV1NoteData(buffer: Buffer, noteCount: number): MapNote[] {
  let cursor = 0;
  const notes: MapNote[] = [];
  for (let i = 0; i < noteCount; i += 1) {
    if (cursor + 5 > buffer.length) throw new Error("SSPM v1 note data is truncated.");
    const time = buffer.readUInt32LE(cursor);
    cursor += 4;
    const storageType = buffer[cursor++];
    let x: number;
    let y: number;
    if (storageType === 0) {
      if (cursor + 2 > buffer.length) throw new Error("SSPM v1 integer note is truncated.");
      x = buffer[cursor++];
      y = buffer[cursor++];
    } else if (storageType === 1) {
      if (cursor + 8 > buffer.length) throw new Error("SSPM v1 quantum note is truncated.");
      x = buffer.readFloatLE(cursor);
      y = buffer.readFloatLE(cursor + 4);
      cursor += 8;
    } else throw new Error(`Unsupported SSPM v1 note storage type ${storageType}.`);
    if (Number.isFinite(time) && Number.isFinite(x) && Number.isFinite(y)) notes.push({ time, x, y });
  }
  return notes.sort((a, b) => a.time - b.time);
}

export function parseSspmV1Notes(data: Uint8Array): MapNote[] {
  const buffer = Buffer.from(data);
  const header = parseV1Header(buffer);
  let cursor = header.audioOffset;
  if (cursor >= buffer.length) throw new Error("SSPM v1 audio metadata is missing.");
  const audioType = buffer[cursor++];
  if (audioType === 1) {
    if (cursor + 8 > buffer.length) throw new Error("SSPM v1 audio metadata is incomplete.");
    const length = Number(buffer.readBigUInt64LE(cursor));
    if (!Number.isSafeInteger(length) || length < 0) throw new Error("Invalid SSPM v1 audio length.");
    cursor += 8 + length;
  } else if (audioType !== 0) throw new Error("Unsupported SSPM v1 audio type.");
  if (cursor > buffer.length) throw new Error("SSPM v1 media block exceeds the file length.");
  return parseV1NoteData(buffer.subarray(cursor), header.noteCount);
}

function analyzeLegacyNotes(notes: MapNote[]): LegacyAnalysisBundle {
  const analysis = analyzeMapNotes(notes);
  return { analysis, rankability: analyzeMapRankability(notes, analysis.topSections) };
}

async function fetchRange(url: string, start: number, end: number) {
  const response = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    headers: { range: `bytes=${start}-${end}`, accept: "application/octet-stream,*/*;q=0.1", "user-agent": `Rhythians-LegacyMapAnalyzer/${MAP_ANALYZER_VERSION}.0` },
  });
  if (response.status !== 206) throw new Error("Legacy map source does not support safe ranged analysis.");
  return new Uint8Array(await response.arrayBuffer());
}

async function analyzeRangedV1(url: string): Promise<LegacyAnalysisBundle> {
  const initial = Buffer.from(await fetchRange(url, 0, INITIAL_HEADER_BYTES - 1));
  const header = parseV1Header(initial);
  const audioMeta = Buffer.from(await fetchRange(url, header.audioOffset, header.audioOffset + 8));
  if (!audioMeta.length) throw new Error("SSPM v1 audio metadata is missing.");
  const audioType = audioMeta[0];
  let noteOffset = header.audioOffset + 1;
  if (audioType === 1) {
    if (audioMeta.length < 9) throw new Error("SSPM v1 audio metadata is incomplete.");
    const length = Number(audioMeta.readBigUInt64LE(1));
    if (!Number.isSafeInteger(length) || length < 0) throw new Error("Invalid SSPM v1 audio length.");
    noteOffset += 8 + length;
  } else if (audioType !== 0) throw new Error("Unsupported SSPM v1 audio type.");
  const maximumLength = header.noteCount * 13;
  if (!Number.isSafeInteger(maximumLength) || maximumLength <= 0 || maximumLength > MAX_NOTE_BYTES) throw new Error("SSPM v1 note data is too large to analyze safely.");
  const noteBytes = Buffer.from(await fetchRange(url, noteOffset, noteOffset + maximumLength - 1));
  return analyzeLegacyNotes(parseV1NoteData(noteBytes, header.noteCount));
}

export async function analyzeLegacyMapUrl(url: string): Promise<LegacyAnalysisBundle> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { cache: "no-store", redirect: "follow", signal: controller.signal, headers: { accept: "application/octet-stream,*/*;q=0.1", "user-agent": `Rhythians-LegacyMapAnalyzer/${MAP_ANALYZER_VERSION}.0` } });
    if (!response.ok) throw new Error(`Legacy map download returned HTTP ${response.status}.`);
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (Number.isFinite(declared) && declared > MAX_MAP_BYTES) {
      await response.body?.cancel();
      return analyzeRangedV1(url);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.byteLength) throw new Error("Legacy map source returned an empty file.");
    if (bytes.byteLength > MAX_MAP_BYTES) return analyzeRangedV1(url);
    const buffer = Buffer.from(bytes);
    if (buffer.length < 6 || buffer.readUInt32LE(0) !== 0x6d2b5353 || buffer.readUInt16LE(4) !== 1) throw new Error("Legacy map is not SSPM v1.");
    return analyzeLegacyNotes(parseSspmV1Notes(bytes));
  } finally { clearTimeout(timeout); }
}

export async function analyzeLegacyChallengeMap(mapId: string) {
  const map = await prisma.challengeMap.findUnique({ where: { id: mapId }, select: { id: true, status: true, mapFileUrl: true } });
  if (!map) throw new Error("Map not found.");
  if (map.status !== "legacy") return analyzeChallengeMap(mapId);
  try {
    const { analysis, rankability } = await analyzeLegacyMapUrl(map.mapFileUrl);
    return await saveMapAnalysis(map.id, "legacy", analysis, rankability);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Legacy map analysis failed.";
    await markMapAnalysisFailed(map.id, "legacy", message);
    throw new Error(message);
  }
}
