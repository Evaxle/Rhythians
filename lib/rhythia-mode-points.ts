import { prisma } from "@/lib/db";
import { rhythiaRequest } from "@/lib/rhythia";
import { speedProfileAt, MAP_ANALYZER_VERSION, type MapSpeedProfile } from "@/lib/map-difficulty";
import { ensureMapAnalysisTable } from "@/lib/map-analysis-store";
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
  passed?: boolean | null;
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
};

type ScoreBucketName = "lastDay" | "top" | "vrTop" | "vrRecent" | "recent" | "scores" | "passed" | "items" | "results" | "data";
type ScoreBucket = { name: ScoreBucketName; scores: ScorePayload[] };
type ScoreResponse = Partial<Record<Exclude<ScoreBucketName, "items" | "results" | "data">, ScorePayload[]>> & { items?: ScorePayload[]; results?: ScorePayload[]; data?: ScorePayload[] | { scores?: ScorePayload[] } };
type AnalyzedMapRow = { id: string; title: string; sourceBeatmapId: number | null; rating: number; rpl: number; rpv: number; rps: number; speedProfiles: unknown };

function normalize(value: string | null | undefined) { return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function normalizeSourceId(value: number) { return Number.isSafeInteger(value) && value > 0x7fffffff && value <= 0xffffffff ? value - 0x100000000 : value; }
function text(value: unknown) {
  if (Array.isArray(value)) return value.map(String).join(" ");
  if (value && typeof value === "object") return Object.entries(value as Record<string, unknown>).map(([key, item]) => `${key} ${String(item)}`).join(" ");
  return typeof value === "string" ? value : "";
}
function enabled(value: unknown) {
  if (value === true || value === 1) return true;
  if (typeof value !== "string") return false;
  return ["1", "true", "yes", "on", "enabled", "spin", "vr"].includes(value.trim().toLowerCase());
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
function parseProfiles(value: unknown): MapSpeedProfile[] {
  if (Array.isArray(value)) return value as MapSpeedProfile[];
  if (typeof value === "string") { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed as MapSpeedProfile[] : []; } catch { return []; } }
  return [];
}
function modeDetails(score: ScorePayload, sourceBucket: ScoreBucketName) {
  const explicit = [score.cameraMode, score.camera_mode, score.gameMode, score.game_mode, score.mode, score.playMode, score.play_mode, score.camera, score.camera_mode_name, score.play_mode_name].map(text).join(" ").toLowerCase();
  const modifiers = [score.mods, score.modifiers, score.modifiers_json, score.settings].map(text).join(" ").toLowerCase();
  if (explicit.includes("vr") || explicit.includes("virtual reality")) return { mode: "vr" as const, confidence: 3 };
  if (explicit.includes("spin")) return { mode: "spin" as const, confidence: 3 };
  if (explicit.includes("lock")) return { mode: "lock" as const, confidence: 3 };
  if (enabled(score.vr) || enabled(score.isVr) || enabled(score.is_vr) || /(^|[^a-z])vr([^a-z]|$)/i.test(modifiers) || /virtual\s*reality/i.test(modifiers)) return { mode: "vr" as const, confidence: 2 };
  if (enabled(score.spin) || enabled(score.isSpin) || enabled(score.is_spin) || enabled(score.spinMode) || enabled(score.spin_mode) || /(^|[^a-z])spin([^a-z]|$)/i.test(modifiers)) return { mode: "spin" as const, confidence: 2 };
  if (sourceBucket === "vrTop" || sourceBucket === "vrRecent") return { mode: "vr" as const, confidence: 1 };
  return { mode: "lock" as const, confidence: 0 };
}

export function scoreCameraMode(score: ScorePayload, sourceBucket: ScoreBucketName): ModeKey { return modeDetails(score, sourceBucket).mode; }
export function modeDifficultyMultiplier(rating: number | null | undefined) { return rating == null || !Number.isFinite(rating) ? 0 : Math.max(0, rating); }
export function pointsForModeScore(score: ScorePayload, mode: ModeKey, rating?: number | null) {
  if (score.passed !== true || rating == null || !Number.isFinite(rating)) return 0;
  const r = Math.max(0, rating);
  return Math.max(1, Math.round((12 + 8 * r + 1.5 * r * r) * MODE_RULES[mode].rewardMultiplier));
}

function scoreBuckets(data: ScoreResponse): ScoreBucket[] {
  const buckets: ScoreBucket[] = [];
  for (const name of ["lastDay", "top", "vrTop", "vrRecent", "recent", "scores", "passed"] as const) {
    const scores = data[name];
    if (Array.isArray(scores)) buckets.push({ name, scores });
  }
  if (Array.isArray(data.items)) buckets.push({ name: "items", scores: data.items });
  if (Array.isArray(data.results)) buckets.push({ name: "results", scores: data.results });
  if (Array.isArray(data.data)) buckets.push({ name: "data", scores: data.data });
  else if (data.data && typeof data.data === "object" && Array.isArray(data.data.scores)) buckets.push({ name: "data", scores: data.data.scores });
  return buckets;
}

async function fetchModeScores(profileId: number) {
  const data = await rhythiaRequest<ScoreResponse>("getUserScores", { id: profileId, limit: 10000 });
  const byId = new Map<number, { score: ScorePayload; mode: ModeKey; confidence: number }>();
  for (const bucket of scoreBuckets(data)) for (const score of bucket.scores) {
    if (!score || typeof score.id !== "number") continue;
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
    return { id: score.id, beatmapTitle: scoreTitle(score).trim(), sourceBeatmapId: source == null ? null : normalizeSourceId(source), cameraMode: mode, speed: Number.isFinite(score.speed) && (score.speed ?? 0) > 0 ? score.speed! : 1, accuracy: accuracyFromScore(score), awardedSp: scoreAwardedSp(score), createdAt: created && Number.isFinite(created.getTime()) ? created : null, passed: score.passed === true };
  });
}

async function analyzedMaps() {
  await ensureMapAnalysisTable();
  return prisma.$queryRawUnsafe<AnalyzedMapRow[]>(`
    SELECT c.id,c.title,c."sourceBeatmapId",a.rating,a.rpl,a.rpv,a.rps,a."speedProfiles"
    FROM "ChallengeMap" c
    JOIN "MapDifficultyAnalysis" a ON a."mapId"=c.id
    WHERE c.status='approved' AND a.status='analyzed' AND a."pointEligible"=TRUE AND a."analyzerVersion"=$1 AND a.rating IS NOT NULL`, MAP_ANALYZER_VERSION);
}
function mapKey(map: Pick<AnalyzedMapRow, "id" | "sourceBeatmapId">) { return map.sourceBeatmapId != null ? `rhythia:${map.sourceBeatmapId}` : `map:${map.id}`; }
function rewardFor(map: AnalyzedMapRow, mode: ModeKey, speed: number | null | undefined) {
  const profile = speedProfileAt(parseProfiles(map.speedProfiles), speed);
  if (profile) return profile.rewards[mode];
  if (mode === "lock") return map.rpl;
  if (mode === "vr") return map.rpv;
  return map.rps;
}

export async function getUserPointOverrides(_userId: string) { return new Map<EditablePointSystem, number>(); }
export async function setUserPointOverride(userId: string, system: EditablePointSystem, points: number | null) {
  await prisma.$executeRawUnsafe('DELETE FROM "UserPointOverride" WHERE "userId"=$1 AND "system"=$2', userId, system).catch(() => 0);
  if (points != null) throw new Error("Manual ranking-point overrides are disabled. RPL, RPV, RPS and RHP are earned from passing analyzed maps only.");
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
  const rhp = rpl + rps + rpv;
  return { rpl, rps, rpv, rhp, raw, earnedRhp: rhp };
}

export async function reconcileUserRankPoints(userId: string) {
  const totals = await calculateStoredTotals(userId);
  const current = await prisma.user.findUnique({ where: { id: userId }, select: { rhp: true } });
  if (current && current.rhp !== totals.rhp) await prisma.user.update({ where: { id: userId }, data: { rhp: totals.rhp } });
  return { ...totals, changed: current?.rhp !== totals.rhp };
}

async function recalculateExistingRows(userId: string, maps: AnalyzedMapRow[]) {
  const byKey = new Map(maps.map((map) => [mapKey(map), map]));
  const keys = [...byKey.keys()];
  if (!keys.length) { await prisma.rhythiaModeScore.deleteMany({ where: { userId } }); return; }
  await prisma.rhythiaModeScore.deleteMany({ where: { userId, mapKey: { notIn: keys } } });
  const existing = await prisma.rhythiaModeScore.findMany({ where: { userId, mapKey: { in: keys } }, select: { id: true, mapKey: true, cameraMode: true, speed: true, points: true } });
  const updates = existing.map((row) => {
    const map = byKey.get(row.mapKey);
    if (!map) return null;
    const points = rewardFor(map, row.cameraMode as ModeKey, row.speed);
    return points === row.points ? null : prisma.rhythiaModeScore.update({ where: { id: row.id }, data: { points } });
  }).filter((value): value is NonNullable<typeof value> => value !== null);
  if (updates.length) await prisma.$transaction(updates);
}

export async function syncUserModeScores(userId: string) {
  const [profile, user, maps] = await Promise.all([
    prisma.rhythiaProfile.findUnique({ where: { userId }, select: { profileId: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { rhp: true } }),
    analyzedMaps(),
  ]);
  if (!profile || !user) return { rpl: 0, rps: 0, rpv: 0, rhp: 0, rows: [] as RhythiaModeScoreRow[], foundModes: { lock: 0, spin: 0, vr: 0 }, added: 0, rankIndex: 0 };
  await recalculateExistingRows(userId, maps);
  const scores = await fetchModeScores(profile.profileId);
  const byBeatmapId = new Map<number, AnalyzedMapRow>();
  const byTitle = new Map<string, AnalyzedMapRow>();
  for (const map of maps) {
    if (map.sourceBeatmapId != null) byBeatmapId.set(map.sourceBeatmapId, map);
    byTitle.set(normalize(map.title), map);
  }
  const candidates = new Map<string, { score: ScorePayload; mode: ModeKey; map: AnalyzedMapRow; points: number }>();
  for (const entry of scores) {
    if (entry.score.passed !== true) continue;
    const sourceId = scoreSourceId(entry.score);
    const normalizedId = sourceId == null ? null : normalizeSourceId(sourceId);
    const map = normalizedId != null ? byBeatmapId.get(normalizedId) ?? byTitle.get(normalize(scoreTitle(entry.score))) : byTitle.get(normalize(scoreTitle(entry.score)));
    if (!map) continue;
    const points = rewardFor(map, entry.mode, entry.score.speed);
    const key = `${mapKey(map)}:${entry.mode}`;
    const candidate = { score: entry.score, mode: entry.mode, map, points };
    const old = candidates.get(key);
    const awarded = scoreAwardedSp(entry.score) ?? 0;
    const oldAwarded = old ? scoreAwardedSp(old.score) ?? 0 : 0;
    const created = scoreCreatedAt(entry.score) ?? "";
    const oldCreated = old ? scoreCreatedAt(old.score) ?? "" : "";
    if (!old || points > old.points || points === old.points && awarded > oldAwarded || points === old.points && awarded === oldAwarded && created > oldCreated) candidates.set(key, candidate);
  }
  const previous = await prisma.rhythiaModeScore.findMany({ where: { userId }, select: { mapKey: true, cameraMode: true, scoreId: true, points: true } });
  const previousKeys = new Set(previous.map((row) => `${row.mapKey}:${row.cameraMode}:${row.scoreId}`));
  let added = 0;
  for (const candidate of candidates.values()) {
    const key = mapKey(candidate.map);
    const existing = previous.find((row) => row.mapKey === key && row.cameraMode === candidate.mode);
    if (existing && existing.points > candidate.points) continue;
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
  const rows: RhythiaModeScoreRow[] = stored.map((row) => ({ id: row.id, mapKey: row.mapKey, mapTitle: row.mapTitle, scoreId: row.scoreId, cameraMode: row.cameraMode as ModeKey, points: row.points, accuracy: row.accuracy, awardedSp: row.awardedSp, speed: row.speed }));
  return { rpl: totals.rpl, rps: totals.rps, rpv: totals.rpv, rhp: totals.rhp, rows, foundModes: { lock: rows.filter((row) => row.cameraMode === "lock").length, spin: rows.filter((row) => row.cameraMode === "spin").length, vr: rows.filter((row) => row.cameraMode === "vr").length }, added, raw: totals.raw };
}

export async function recalculateUsersForMapAnalysis(mapId: string) {
  await ensureMapAnalysisTable();
  const maps = await prisma.$queryRawUnsafe<AnalyzedMapRow[]>(`
    SELECT c.id,c.title,c."sourceBeatmapId",a.rating,a.rpl,a.rpv,a.rps,a."speedProfiles"
    FROM "ChallengeMap" c JOIN "MapDifficultyAnalysis" a ON a."mapId"=c.id
    WHERE c.id=$1 AND a.status='analyzed' AND a."pointEligible"=TRUE AND a."analyzerVersion"=$2 LIMIT 1`, mapId, MAP_ANALYZER_VERSION);
  const map = maps[0] ?? null;
  const mapRow = await prisma.challengeMap.findUnique({ where: { id: mapId }, select: { id: true, sourceBeatmapId: true } });
  if (!mapRow) return { users: 0 };
  const key = mapRow.sourceBeatmapId != null ? `rhythia:${mapRow.sourceBeatmapId}` : `map:${mapRow.id}`;
  const rows = await prisma.rhythiaModeScore.findMany({ where: { mapKey: key }, select: { id: true, userId: true, cameraMode: true, speed: true } });
  const userIds = [...new Set(rows.map((row) => row.userId))];
  if (!map) await prisma.rhythiaModeScore.deleteMany({ where: { mapKey: key } });
  else {
    const updates = rows.map((row) => prisma.rhythiaModeScore.update({ where: { id: row.id }, data: { points: rewardFor(map, row.cameraMode as ModeKey, row.speed) } }));
    if (updates.length) await prisma.$transaction(updates);
  }
  for (const userId of userIds) await reconcileUserRankPoints(userId);
  return { users: userIds.length };
}

export async function getModeScoreMap(userId: string) {
  const rows = await prisma.rhythiaModeScore.findMany({ where: { userId }, select: { mapTitle: true, cameraMode: true, points: true } });
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