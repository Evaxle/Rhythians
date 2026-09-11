import { prisma } from "@/lib/db";
import { rhythiaRequest } from "@/lib/rhythia";
import { speedProfileAt, type MapPatternSegment, type MapSpeedProfile } from "@/lib/map-difficulty";
import { ensureMapAnalysisTable, UNRANKED_MAP_MARKER } from "@/lib/map-analysis-store";
import { MODE_RULES, type ModeKey, type ModePoints } from "@/lib/rhythia-mode-rules";

export { MODE_RULES } from "@/lib/rhythia-mode-rules";
export type { ModeKey, ModePoints } from "@/lib/rhythia-mode-rules";
export type EditablePointSystem = "rhp" | "rpl" | "rps" | "rpv";
export type RhythiaModeScoreRow = { id: string; mapKey: string; mapTitle: string; scoreId: number; cameraMode: ModeKey; points: number; accuracy: number | null; awardedSp: number | null; speed: number | null };
export type RecentModeScore = { id: number; beatmapTitle: string; sourceBeatmapId: number | null; cameraMode: ModeKey; speed: number; accuracy: number | null; awardedSp: number | null; createdAt: Date | null; passed: boolean };

type ScorePayload = {
  id: number;
  beatmapTitle?: string | null;
  beatmap_title?: string | null;
  title?: string | null;
  beatmapId?: number | null;
  beatmap_id?: number | null;
  mapId?: number | null;
  map_id?: number | null;
  beatmapHash?: string | null;
  passed?: boolean | number | string | null;
  misses?: number | null;
  beatmapNotes?: number | null;
  beatmap_notes?: number | null;
  accuracy?: number | null;
  speed?: number | null;
  awarded_sp?: number | null;
  awardedSp?: number | null;
  created_at?: string | null;
  createdAt?: string | null;
  cameraMode?: unknown;
  camera_mode?: unknown;
  gameMode?: unknown;
  game_mode?: unknown;
  mode?: unknown;
  playMode?: unknown;
  play_mode?: unknown;
  camera?: unknown;
  camera_mode_name?: unknown;
  play_mode_name?: unknown;
  spin?: unknown;
  isSpin?: unknown;
  is_spin?: unknown;
  spinMode?: unknown;
  spin_mode?: unknown;
  vr?: unknown;
  isVr?: unknown;
  is_vr?: unknown;
  mods?: unknown;
  modifiers?: unknown;
  modifiers_json?: unknown;
  settings?: unknown;
  [key: string]: unknown;
};
type ScoreBucket = { name: string; scores: ScorePayload[] };
type AnalyzedMapRow = { id: string; title: string; sourceBeatmapId: number | null; rating: number; rpl: number; rpv: number; rps: number; speedProfiles: unknown; patternSegments: unknown };
type RankedMapIdentity = { id: string; sourceBeatmapId: number | null };

function clamp(value: number, min = 0, max = 1) { return Math.min(max, Math.max(min, value)); }
function normalize(value: string | null | undefined) { return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function normalizeSourceId(value: number) { return Number.isSafeInteger(value) && value > 0x7fffffff && value <= 0xffffffff ? value - 0x100000000 : value; }
function text(value: unknown) {
  if (Array.isArray(value)) return value.map(String).join(" ");
  if (value && typeof value === "object") return Object.entries(value as Record<string, unknown>).map(([key, item]) => `${key} ${String(item)}`).join(" ");
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}
function enabled(value: unknown) {
  if (value === true || value === 1) return true;
  if (typeof value !== "string") return false;
  return ["1", "true", "yes", "on", "enabled", "spin", "vr"].includes(value.trim().toLowerCase());
}
function scorePassed(score: ScorePayload) {
  if (score.passed === true || score.passed === 1) return true;
  if (score.passed === false || score.passed === 0) return false;
  if (typeof score.passed === "string") {
    const value = score.passed.trim().toLowerCase();
    if (["true", "1", "passed", "pass", "yes"].includes(value)) return true;
    if (["false", "0", "failed", "fail", "no"].includes(value)) return false;
  }
  return typeof score.accuracy === "number" && Number.isFinite(score.accuracy) && score.accuracy > 0;
}
function scoreTitle(score: ScorePayload) { return score.beatmapTitle ?? score.beatmap_title ?? score.title ?? ""; }
function scoreSourceId(score: ScorePayload) { return score.beatmapId ?? score.beatmap_id ?? score.mapId ?? score.map_id ?? null; }
function scoreCreatedAt(score: ScorePayload) { return score.created_at ?? score.createdAt ?? null; }
function scoreAwardedSp(score: ScorePayload) { return score.awarded_sp ?? score.awardedSp ?? null; }
function accuracyFromScore(score: ScorePayload) {
  if (score.accuracy != null && Number.isFinite(score.accuracy)) return Math.max(0, Math.min(100, score.accuracy));
  const notes = score.beatmapNotes ?? score.beatmap_notes ?? null;
  if (!notes || notes <= 0 || score.misses == null) return null;
  return Math.max(0, Math.min(100, ((notes - score.misses) / notes) * 100));
}
function parseArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed as T[] : []; } catch { return []; } }
  return [];
}
function parseProfiles(value: unknown) { return parseArray<MapSpeedProfile>(value); }
function modeDetails(score: ScorePayload, sourceBucket: string) {
  const explicit = [score.cameraMode, score.camera_mode, score.gameMode, score.game_mode, score.mode, score.playMode, score.play_mode, score.camera, score.camera_mode_name, score.play_mode_name].map(text).join(" ").toLowerCase();
  const modifiers = [score.mods, score.modifiers, score.modifiers_json, score.settings].map(text).join(" ").toLowerCase();
  const bucket = sourceBucket.toLowerCase();
  if (explicit.includes("vr") || explicit.includes("virtual reality")) return { mode: "vr" as const, confidence: 4 };
  if (explicit.includes("spin")) return { mode: "spin" as const, confidence: 4 };
  if (explicit.includes("lock")) return { mode: "lock" as const, confidence: 4 };
  if (enabled(score.vr) || enabled(score.isVr) || enabled(score.is_vr) || /(^|[^a-z])vr([^a-z]|$)/i.test(modifiers) || /virtual\s*reality/i.test(modifiers)) return { mode: "vr" as const, confidence: 3 };
  if (enabled(score.spin) || enabled(score.isSpin) || enabled(score.is_spin) || enabled(score.spinMode) || enabled(score.spin_mode) || /(^|[^a-z])spin([^a-z]|$)/i.test(modifiers)) return { mode: "spin" as const, confidence: 3 };
  if (bucket.includes("spin")) return { mode: "spin" as const, confidence: 2 };
  if (bucket.includes("vr")) return { mode: "vr" as const, confidence: 2 };
  return { mode: "lock" as const, confidence: 1 };
}
function scoreBuckets(value: unknown, path = "root", result: ScoreBucket[] = []) {
  if (!value || typeof value !== "object") return result;
  if (Array.isArray(value)) {
    const scores = value.filter((item): item is ScorePayload => Boolean(item) && typeof item === "object" && typeof (item as Record<string, unknown>).id === "number");
    if (scores.length) result.push({ name: path, scores });
    return result;
  }
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) scoreBuckets(nested, `${path}.${key}`, result);
  return result;
}
function numericTime(record: Record<string, unknown>) {
  for (const key of ["time", "timeMs", "time_ms", "timestamp", "timestampMs", "timestamp_ms", "noteTime", "note_time", "noteTimeMs", "note_time_ms"]) {
    const value = record[key];
    const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
    if (Number.isFinite(number) && number >= 0) return number;
  }
  return null;
}
function looksLikeMiss(record: Record<string, unknown>, path: string) {
  const state = [record.result, record.judgement, record.judgment, record.status, record.type, record.grade].map(text).join(" ").toLowerCase();
  return path.toLowerCase().includes("miss") || state.includes("miss") || record.missed === true || record.isMiss === true || record.is_miss === true || record.hit === false;
}
function extractMissTimes(score: ScorePayload) {
  const times: number[] = [];
  const seen = new Set<unknown>();
  function visit(value: unknown, path: string, depth: number) {
    if (value == null || depth > 8) return;
    if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
      if (path.toLowerCase().includes("misstime") || path.toLowerCase().includes("miss_time")) {
        const number = typeof value === "number" ? value : Number(value);
        if (Number.isFinite(number) && number >= 0) times.push(number);
      }
      return;
    }
    if (seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const item of value) visit(item, path, depth + 1);
      return;
    }
    const record = value as Record<string, unknown>;
    if (looksLikeMiss(record, path)) {
      const time = numericTime(record);
      if (time != null) times.push(time);
    }
    for (const [key, nested] of Object.entries(record)) {
      if (["beatmap", "map", "chart", "metadata"].includes(key.toLowerCase())) continue;
      visit(nested, `${path}.${key}`, depth + 1);
    }
  }
  for (const key of ["replay", "replayData", "replay_data", "judgements", "judgments", "hitResults", "hit_results", "events", "missEvents", "miss_events", "missedNotes", "missed_notes", "missTimes", "miss_times", "notes"]) {
    if (score[key] !== undefined) visit(score[key], key, 0);
  }
  return [...new Set(times.map((value) => Math.round(value)))].sort((a, b) => a - b);
}
function missRate(score: ScorePayload) {
  const notes = score.beatmapNotes ?? score.beatmap_notes ?? null;
  if (notes && notes > 0 && typeof score.misses === "number" && Number.isFinite(score.misses)) return clamp(score.misses / notes);
  const accuracy = accuracyFromScore(score);
  return accuracy == null ? 0 : clamp(1 - accuracy / 100);
}
function missBalanceMultiplier(map: AnalyzedMapRow, score: ScorePayload) {
  const rate = missRate(score);
  if (rate <= 0) return 1;
  const segments = parseArray<MapPatternSegment>(map.patternSegments).filter((segment) => Number.isFinite(segment.startMs) && Number.isFinite(segment.endMs) && segment.endMs > segment.startMs);
  const times = extractMissTimes(score);
  const aggregate = clamp(1 - Math.pow(rate, 0.68) * 1.45, 0.58, 1);
  if (!segments.length || !times.length) return aggregate;
  const counts = new Array(segments.length).fill(0) as number[];
  let matched = 0;
  let difficultySum = 0;
  const peak = Math.max(0.001, ...segments.map((segment) => Math.max(segment.peakStrain, segment.averageStrain)));
  for (const rawTime of times) {
    const speed = Number.isFinite(score.speed) && (score.speed ?? 0) > 0 ? score.speed! : 1;
    const mapTime = rawTime * speed;
    const index = segments.findIndex((segment) => mapTime >= segment.startMs && mapTime < segment.endMs);
    if (index < 0) continue;
    counts[index] += 1;
    matched += 1;
    difficultySum += clamp(Math.max(segments[index].peakStrain, segments[index].averageStrain) / peak);
  }
  if (!matched) return aggregate;
  const occupied = counts.filter((count) => count > 0);
  const entropy = occupied.reduce((sum, count) => { const p = count / matched; return sum - p * Math.log(p); }, 0);
  const balance = occupied.length <= 1 ? 0 : clamp(entropy / Math.log(Math.min(matched, segments.length)));
  const hardSectionForgiveness = clamp(difficultySum / matched);
  const placementFactor = 0.72 + 0.18 * balance + 0.10 * hardSectionForgiveness;
  return clamp(1 - (1 - aggregate) * (2 - placementFactor), 0.52, 1);
}

export function scoreCameraMode(score: ScorePayload, sourceBucket: string): ModeKey { return modeDetails(score, sourceBucket).mode; }
export function modeDifficultyMultiplier(rating: number | null | undefined) { return rating == null || !Number.isFinite(rating) ? 0 : Math.max(0, rating); }
export function pointsForModeScore(score: ScorePayload, mode: ModeKey, rating?: number | null) {
  if (!scorePassed(score) || rating == null || !Number.isFinite(rating)) return 0;
  const r = Math.max(0, rating);
  return Math.max(1, Math.round((12 + 8 * r + 1.5 * r * r) * MODE_RULES[mode].rewardMultiplier));
}

async function fetchModeScores(profileId: number) {
  const data = await rhythiaRequest<Record<string, unknown>>("getUserScores", { id: profileId, limit: 10000 });
  const byId = new Map<number, { score: ScorePayload; mode: ModeKey; confidence: number }>();
  for (const bucket of scoreBuckets(data)) for (const score of bucket.scores) {
    const details = modeDetails(score, bucket.name);
    const existing = byId.get(score.id);
    if (!existing || details.confidence > existing.confidence) byId.set(score.id, { score, mode: details.mode, confidence: details.confidence });
  }
  return [...byId.values()];
}

export async function fetchRecentModeScoresForUser(userId: string): Promise<RecentModeScore[]> {
  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId }, select: { profileId: true } });
  if (!profile) return [];
  const entries = await fetchModeScores(profile.profileId);
  return entries.map(({ score, mode }) => {
    const source = scoreSourceId(score);
    const createdValue = scoreCreatedAt(score);
    const created = createdValue ? new Date(createdValue) : null;
    return { id: score.id, beatmapTitle: scoreTitle(score).trim(), sourceBeatmapId: source == null ? null : normalizeSourceId(source), cameraMode: mode, speed: Number.isFinite(score.speed) && (score.speed ?? 0) > 0 ? score.speed! : 1, accuracy: accuracyFromScore(score), awardedSp: scoreAwardedSp(score), createdAt: created && Number.isFinite(created.getTime()) ? created : null, passed: scorePassed(score) };
  });
}

async function analyzedMaps() {
  await ensureMapAnalysisTable();
  return prisma.$queryRawUnsafe<AnalyzedMapRow[]>(`
    SELECT c.id,c.title,c."sourceBeatmapId",a.rating,a.rpl,a.rpv,a.rps,a."speedProfiles",a."patternSegments"
    FROM "ChallengeMap" c
    JOIN "MapDifficultyAnalysis" a ON a."mapId"=c.id
    WHERE c.status='approved'
      AND COALESCE(c."reviewerNote", '') <> $1
      AND a.status='analyzed'
      AND a."pointEligible"=TRUE
      AND a.rating IS NOT NULL`,
    UNRANKED_MAP_MARKER,
  );
}
function mapKey(map: Pick<AnalyzedMapRow, "id" | "sourceBeatmapId">) { return map.sourceBeatmapId != null ? `rhythia:${map.sourceBeatmapId}` : `map:${map.id}`; }
function identityKey(map: RankedMapIdentity) { return map.sourceBeatmapId != null ? `rhythia:${map.sourceBeatmapId}` : `map:${map.id}`; }
function rewardFor(map: AnalyzedMapRow, mode: ModeKey, speed: number | null | undefined) {
  const profile = speedProfileAt(parseProfiles(map.speedProfiles), speed);
  if (profile) return profile.rewards[mode];
  if (mode === "lock") return map.rpl;
  if (mode === "vr") return map.rpv;
  return map.rps;
}
function scoreReward(map: AnalyzedMapRow, mode: ModeKey, score: ScorePayload) {
  return Math.max(1, Math.round(rewardFor(map, mode, score.speed) * missBalanceMultiplier(map, score)));
}

async function getOverrides(userId: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ system: EditablePointSystem; points: number }>>('SELECT "system","points" FROM "UserPointOverride" WHERE "userId"=$1', userId).catch(() => []);
  return new Map(rows.map((row) => [row.system, Number(row.points)]));
}
export async function getUserPointOverrides(userId: string) { return getOverrides(userId); }
export async function setUserPointOverride(userId: string, system: EditablePointSystem, points: number | null) {
  if (points == null) {
    await prisma.$executeRawUnsafe('DELETE FROM "UserPointOverride" WHERE "userId"=$1 AND "system"=$2', userId, system);
    return;
  }
  await prisma.$executeRawUnsafe('INSERT INTO "UserPointOverride" ("id","userId","system","points","updatedAt") VALUES (gen_random_uuid(),$1,$2,$3,CURRENT_TIMESTAMP) ON CONFLICT ("userId","system") DO UPDATE SET "points"=EXCLUDED."points","updatedAt"=CURRENT_TIMESTAMP', userId, system, Math.max(0, Math.round(points)));
}

export async function calculateStoredTotals(userId: string) {
  const rows = await prisma.rhythiaModeScore.findMany({ where: { userId }, select: { cameraMode: true, points: true } });
  const raw: ModePoints = { lock: 0, spin: 0, vr: 0 };
  for (const row of rows) {
    const mode = row.cameraMode as ModeKey;
    raw[mode] += Math.max(0, Number(row.points) || 0);
  }
  const rpl = Math.round(raw.lock);
  const rps = Math.round(raw.spin);
  const rpv = Math.round(raw.vr);
  const earnedRhp = rpl + rps + rpv;
  return { rpl, rps, rpv, rhp: earnedRhp, raw: { lock: rpl, spin: rps, vr: rpv }, earnedRhp };
}

export async function reconcileUserRankPoints(userId: string) {
  const totals = await calculateStoredTotals(userId);
  const current = await prisma.user.findUnique({ where: { id: userId }, select: { rhp: true } });
  if (current && current.rhp !== totals.rhp) await prisma.user.update({ where: { id: userId }, data: { rhp: totals.rhp } });
  return { ...totals, changed: current?.rhp !== totals.rhp };
}

async function removableRankKeys() {
  await ensureMapAnalysisTable();
  const ranked = await prisma.$queryRawUnsafe<RankedMapIdentity[]>(`
    SELECT c.id,c."sourceBeatmapId"
    FROM "ChallengeMap" c
    LEFT JOIN "MapDifficultyAnalysis" a ON a."mapId"=c.id
    WHERE c.status='approved'
      AND COALESCE(c."reviewerNote", '') <> $1
      AND (a."pointEligible"=TRUE OR a.status='failed')`,
    UNRANKED_MAP_MARKER,
  );
  return new Set(ranked.map(identityKey));
}

async function removeIneligibleRows(userId: string) {
  const keepKeys = await removableRankKeys();
  // Never mass-delete score history when the catalog/analysis table is temporarily empty.
  if (!keepKeys.size) return;
  const rows = await prisma.rhythiaModeScore.findMany({ where: { userId }, select: { id: true, mapKey: true } });
  const removeIds = rows.filter((row) => !keepKeys.has(row.mapKey)).map((row) => row.id);
  if (removeIds.length) await prisma.rhythiaModeScore.deleteMany({ where: { id: { in: removeIds } } });
}

function mappedRows(rows: Awaited<ReturnType<typeof prisma.rhythiaModeScore.findMany>>) {
  return rows.map((row) => ({ id: row.id, mapKey: row.mapKey, mapTitle: row.mapTitle, scoreId: row.scoreId, cameraMode: row.cameraMode as ModeKey, points: row.points, accuracy: row.accuracy, awardedSp: row.awardedSp, speed: row.speed }));
}

export async function syncUserModeScores(userId: string) {
  const [profile, user, maps, previous] = await Promise.all([
    prisma.rhythiaProfile.findUnique({ where: { userId }, select: { profileId: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { rhp: true } }),
    analyzedMaps(),
    prisma.rhythiaModeScore.findMany({ where: { userId }, orderBy: { points: "desc" } }),
  ]);
  if (!profile || !user) return { rpl: 0, rps: 0, rpv: 0, rhp: user?.rhp ?? 0, rows: [] as RhythiaModeScoreRow[], foundModes: { lock: 0, spin: 0, vr: 0 }, added: 0, rankIndex: 0 };

  // Fetch before mutating anything. A Rhythia outage must never erase a user's last known good ranks.
  const scores = await fetchModeScores(profile.profileId);
  if (!scores.length && previous.length) {
    const totals = await reconcileUserRankPoints(userId);
    const rows = mappedRows(previous);
    return { rpl: totals.rpl, rps: totals.rps, rpv: totals.rpv, rhp: totals.rhp, rows, foundModes: { lock: rows.filter((row) => row.cameraMode === "lock").length, spin: rows.filter((row) => row.cameraMode === "spin").length, vr: rows.filter((row) => row.cameraMode === "vr").length }, added: 0, raw: totals.raw, preserved: true };
  }

  await removeIneligibleRows(userId);

  const byBeatmapId = new Map<number, AnalyzedMapRow>();
  const byTitle = new Map<string, AnalyzedMapRow>();
  for (const map of maps) {
    if (map.sourceBeatmapId != null) byBeatmapId.set(map.sourceBeatmapId, map);
    byTitle.set(normalize(map.title), map);
  }
  const candidates = new Map<string, { score: ScorePayload; mode: ModeKey; map: AnalyzedMapRow; points: number }>();
  for (const entry of scores) {
    if (!scorePassed(entry.score)) continue;
    const sourceId = scoreSourceId(entry.score);
    const normalizedId = sourceId == null ? null : normalizeSourceId(sourceId);
    const map = normalizedId != null ? byBeatmapId.get(normalizedId) ?? byTitle.get(normalize(scoreTitle(entry.score))) : byTitle.get(normalize(scoreTitle(entry.score)));
    if (!map) continue;
    const points = scoreReward(map, entry.mode, entry.score);
    const key = `${mapKey(map)}:${entry.mode}`;
    const candidate = { score: entry.score, mode: entry.mode, map, points };
    const old = candidates.get(key);
    const accuracy = accuracyFromScore(entry.score) ?? 0;
    const oldAccuracy = old ? accuracyFromScore(old.score) ?? 0 : 0;
    const awarded = scoreAwardedSp(entry.score) ?? 0;
    const oldAwarded = old ? scoreAwardedSp(old.score) ?? 0 : 0;
    const created = scoreCreatedAt(entry.score) ?? "";
    const oldCreated = old ? scoreCreatedAt(old.score) ?? "" : "";
    if (!old || points > old.points || points === old.points && accuracy > oldAccuracy || points === old.points && accuracy === oldAccuracy && awarded > oldAwarded || points === old.points && accuracy === oldAccuracy && awarded === oldAwarded && created > oldCreated) candidates.set(key, candidate);
  }

  const previousKeys = new Set(previous.map((row) => `${row.mapKey}:${row.cameraMode}:${row.scoreId}`));
  const candidateKeys = new Set(candidates.keys());
  const analyzedKeys = new Set(maps.map(mapKey));
  const staleIds = previous.filter((row) => analyzedKeys.has(row.mapKey) && !candidateKeys.has(`${row.mapKey}:${row.cameraMode}`));
  if (staleIds.length) await prisma.rhythiaModeScore.deleteMany({ where: { userId, OR: staleIds.map((row) => ({ mapKey: row.mapKey, cameraMode: row.cameraMode })) } });

  let added = 0;
  for (const candidate of candidates.values()) {
    const key = mapKey(candidate.map);
    if (!previousKeys.has(`${key}:${candidate.mode}:${candidate.score.id}`)) added += 1;
    await prisma.rhythiaModeScore.upsert({
      where: { userId_mapKey_cameraMode: { userId, mapKey: key, cameraMode: candidate.mode } },
      create: { userId, mapKey: key, mapTitle: candidate.map.title, scoreId: candidate.score.id, cameraMode: candidate.mode, points: candidate.points, accuracy: accuracyFromScore(candidate.score), awardedSp: scoreAwardedSp(candidate.score), speed: candidate.score.speed ?? 1 },
      update: { mapTitle: candidate.map.title, scoreId: candidate.score.id, points: candidate.points, accuracy: accuracyFromScore(candidate.score), awardedSp: scoreAwardedSp(candidate.score), speed: candidate.score.speed ?? 1 },
    });
  }

  const stored = await prisma.rhythiaModeScore.findMany({ where: { userId }, orderBy: { points: "desc" } });
  const mapByKey = new Map(maps.map((map) => [mapKey(map), map]));
  const completionBest = new Map<string, typeof stored[number]>();
  for (const row of stored) {
    const old = completionBest.get(row.mapKey);
    if (!old || row.points > old.points) completionBest.set(row.mapKey, row);
  }
  for (const [key, score] of completionBest) {
    const map = mapByKey.get(key);
    if (!map) continue;
    await prisma.challengeMapCompletion.upsert({
      where: { challengeMapId_userId: { challengeMapId: map.id, userId } },
      create: { challengeMapId: map.id, userId, rating: map.rating, accuracy: score.accuracy, passed: true, points: score.points, scoreId: score.scoreId },
      update: { rating: map.rating, accuracy: score.accuracy, passed: true, points: score.points, scoreId: score.scoreId },
    });
  }
  const totals = await reconcileUserRankPoints(userId);
  await prisma.user.update({ where: { id: userId }, data: { scoreImportDone: true, lastRhythiaRpCheckAt: new Date() } });
  const rows: RhythiaModeScoreRow[] = mappedRows(stored);
  return { rpl: totals.rpl, rps: totals.rps, rpv: totals.rpv, rhp: totals.rhp, rows, foundModes: { lock: rows.filter((row) => row.cameraMode === "lock").length, spin: rows.filter((row) => row.cameraMode === "spin").length, vr: rows.filter((row) => row.cameraMode === "vr").length }, added, raw: totals.raw };
}

export async function recalculateUsersForMapAnalysis(mapId: string) {
  await ensureMapAnalysisTable();
  const maps = await prisma.$queryRawUnsafe<AnalyzedMapRow[]>(`
    SELECT c.id,c.title,c."sourceBeatmapId",a.rating,a.rpl,a.rpv,a.rps,a."speedProfiles",a."patternSegments"
    FROM "ChallengeMap" c JOIN "MapDifficultyAnalysis" a ON a."mapId"=c.id
    WHERE c.id=$1 AND a.status='analyzed' AND a."pointEligible"=TRUE LIMIT 1`,
    mapId,
  );
  const map = maps[0] ?? null;
  const mapRow = await prisma.challengeMap.findUnique({ where: { id: mapId }, select: { id: true, sourceBeatmapId: true, status: true, reviewerNote: true } });
  if (!mapRow) return { users: 0 };
  const key = mapRow.sourceBeatmapId != null ? `rhythia:${mapRow.sourceBeatmapId}` : `map:${mapRow.id}`;
  const rows = await prisma.rhythiaModeScore.findMany({ where: { mapKey: key }, select: { userId: true } });
  const userIds = [...new Set(rows.map((row) => row.userId))];
  const explicitlyIneligible = mapRow.status !== "approved" || mapRow.reviewerNote === UNRANKED_MAP_MARKER;
  if (!map && explicitlyIneligible) await prisma.rhythiaModeScore.deleteMany({ where: { mapKey: key } });
  else if (map) for (const affectedUserId of userIds) await syncUserModeScores(affectedUserId);
  for (const affectedUserId of userIds) await reconcileUserRankPoints(affectedUserId);
  return { users: userIds.length };
}

export async function getModeScoreMap(userId: string) {
  const rows = await prisma.rhythiaModeScore.findMany({ where: { userId }, select: { mapKey: true, mapTitle: true, cameraMode: true, points: true } });
  const result: Record<string, ModePoints> = {};
  for (const row of rows) {
    const key = normalize(row.mapTitle);
    if (!key) continue;
    result[key] ??= { lock: 0, spin: 0, vr: 0 };
    const mode = row.cameraMode as ModeKey;
    result[key][mode] = Math.max(result[key][mode], row.points);
  }
  return result;
}

export async function getModeLeaderboard(mode: ModeKey, limit = 100) {
  const safeLimit = Math.max(1, Math.min(500, limit));
  return prisma.$queryRawUnsafe<Array<{ userId: string; username: string; displayName: string | null; profileHandle: string; avatar: string | null; points: number }>>(`
    SELECT u.id AS "userId",u.username,u."displayName",u."profileHandle",u.avatar,COALESCE(SUM(r.points),0)::int AS points
    FROM "User" u
    LEFT JOIN "RhythiaModeScore" r ON r."userId"=u.id AND r."cameraMode"=$1::"CameraMode"
    WHERE u."profileHandle" <> 'rhythia-imports'
    GROUP BY u.id,u.username,u."displayName",u."profileHandle",u.avatar
    ORDER BY points DESC,u.username ASC LIMIT $2`, mode, safeLimit);
}
