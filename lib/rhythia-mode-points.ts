import { prisma } from "@/lib/db";
import { rhythiaRequest } from "@/lib/rhythia";
import { accuracyFromMisses, accuracyMultiplier, difficultyFactorForRating, rankIndexForRating, RANKS, RANK_TIERS, type RankInfo } from "@/lib/ranks";
import { MODE_RULES, type ModeKey, type ModePoints } from "@/lib/rhythia-mode-rules";
import { ensureRankingBaseline, loadRankingConfig, overallRhpFromModes } from "@/lib/ranking-system";

export { MODE_RULES } from "@/lib/rhythia-mode-rules";
export type { ModeKey, ModePoints } from "@/lib/rhythia-mode-rules";
export type EditablePointSystem = "rhp" | "rpl" | "rps" | "rpv";
export type RhythiaModeScoreRow = { id: string; mapKey: string; mapTitle: string; scoreId: number; cameraMode: ModeKey; points: number; accuracy: number | null; awardedSp: number | null };
type ScorePayload = { id: number; beatmapTitle?: string | null; beatmapId?: number | null; mapId?: number | null; beatmapHash?: string | null; passed?: boolean | null; misses?: number | null; beatmapNotes?: number | null; accuracy?: number | null; speed?: number | null; awarded_sp?: number | null; created_at?: string | null; cameraMode?: string | null; gameMode?: string | null; mode?: string | null; spin?: boolean | null; vr?: boolean | null; isVr?: boolean | null; mods?: string | null };
type ScoreBucket = { name: "lastDay" | "top" | "vrTop" | "vrRecent"; scores: ScorePayload[] };
const UNRANKED_MARKER = "rhythia-unranked";

function normalize(value: string | null | undefined) { return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

function scaledRankStart(index: number, mode: ModeKey) { return Math.round(RANKS[index].minRhp * MODE_RULES[mode].rankScale); }

export function modeRankInfo(points: number, mode: ModeKey): RankInfo {
  const safe = Math.max(0, Math.floor(points));
  let index = RANKS.length - 1;
  for (let i = RANKS.length - 1; i >= 0; i -= 1) if (safe >= scaledRankStart(i, mode)) { index = i; break; }
  const rank = RANKS[index];
  const isExpert = index === RANKS.length - 1;
  const min = scaledRankStart(index, mode);
  if (isExpert) return { index, name: rank.name, tier: 1, isExpert: true, minRhp: min, maxRhp: null, tierStart: min, tierEnd: Number.POSITIVE_INFINITY, nextTierStart: min, nextRankStart: null, color: rank.color, progressToNextTier: 1, rangeMin: rank.rangeMin, rangeMax: rank.rangeMax };
  const next = scaledRankStart(index + 1, mode);
  const span = Math.max(1, next - min);
  const within = safe - min;
  const tier = Math.min(RANK_TIERS, Math.floor(within * RANK_TIERS / span) + 1);
  const tierStart = min + Math.floor(span * (tier - 1) / RANK_TIERS);
  const tierEnd = tier === RANK_TIERS ? next : min + Math.floor(span * tier / RANK_TIERS);
  const progressToNextTier = Math.min(1, Math.max(0, (safe - tierStart) / Math.max(1, tierEnd - tierStart)));
  return { index, name: rank.name, tier, isExpert: false, minRhp: min, maxRhp: next, tierStart, tierEnd, nextTierStart: tierEnd, nextRankStart: next, color: rank.color, progressToNextTier, rangeMin: rank.rangeMin, rangeMax: rank.rangeMax };
}

export function modeRankLabel(points: number, mode: ModeKey) { const info = modeRankInfo(points, mode); return info.isExpert ? "Expert" : `${info.name} ${info.tier}`; }

function modeDetails(score: ScorePayload, sourceBucket: ScoreBucket["name"]) {
  const explicitValues = [score.cameraMode, score.gameMode, score.mode].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  const explicit = normalize(explicitValues.join(" ")).replace(/ /g, "");
  if (explicit === "vr" || explicit.includes("virtualreality")) return { mode: "vr" as const, confidence: 3 };
  if (explicit.includes("spin")) return { mode: "spin" as const, confidence: 3 };
  if (explicit.includes("lock")) return { mode: "lock" as const, confidence: 3 };
  if (score.vr === true || score.isVr === true) return { mode: "vr" as const, confidence: 2 };
  if (score.spin === true) return { mode: "spin" as const, confidence: 2 };
  if (typeof score.mods === "string") {
    if (/(^|[\s,;+])vr([\s,;+]|$)/i.test(score.mods) || /virtual\s*reality/i.test(score.mods)) return { mode: "vr" as const, confidence: 2 };
    if (/(^|[\s,;+])spin([\s,;+]|$)/i.test(score.mods)) return { mode: "spin" as const, confidence: 2 };
  }
  if (sourceBucket === "vrTop" || sourceBucket === "vrRecent") return { mode: "vr" as const, confidence: 1 };
  return { mode: "lock" as const, confidence: 0 };
}

export function scoreCameraMode(score: ScorePayload, sourceBucket: ScoreBucket["name"]): ModeKey { return modeDetails(score, sourceBucket).mode; }

export function modeDifficultyMultiplier(rating: number | null | undefined) {
  if (rating == null || !Number.isFinite(rating)) return 0.7;
  if (rating <= RANKS[0].rangeMin) return 0.45;
  const last = RANKS[RANKS.length - 1];
  if (rating >= last.rangeMax) return 1;
  const rankIndex = rankIndexForRating(rating);
  const withinRank = difficultyFactorForRating(rating, rankIndex);
  const normalized = Math.min(1, Math.max(0, (rankIndex + withinRank) / RANKS.length));
  return 0.45 + 0.55 * normalized;
}

export function pointsForModeScore(score: ScorePayload, mode: ModeKey, rating?: number | null) {
  if (score.passed !== true) return 0;
  const rule = MODE_RULES[mode];
  const accuracy = score.accuracy ?? accuracyFromMisses(score.beatmapNotes ?? null, score.misses ?? null);
  const accuracyFactor = accuracy == null ? 1 : accuracyMultiplier(accuracy);
  const difficultyFactor = modeDifficultyMultiplier(rating);
  return Math.max(1, Math.min(rule.maxPoints, Math.round(rule.maxPoints * accuracyFactor * difficultyFactor)));
}

async function fetchModeScores(profileId: number) {
  const data = await rhythiaRequest<Partial<Record<ScoreBucket["name"], ScorePayload[]>>>("getUserScores", { id: profileId, limit: 100 });
  const buckets: ScoreBucket[] = [{ name: "lastDay", scores: data.lastDay ?? [] }, { name: "top", scores: data.top ?? [] }, { name: "vrTop", scores: data.vrTop ?? [] }, { name: "vrRecent", scores: data.vrRecent ?? [] }];
  const byId = new Map<number, { score: ScorePayload; mode: ModeKey; confidence: number }>();
  for (const bucket of buckets) for (const score of bucket.scores) {
    if (!score || typeof score.id !== "number") continue;
    const details = modeDetails(score, bucket.name);
    const existing = byId.get(score.id);
    if (!existing || details.confidence > existing.confidence) byId.set(score.id, { score, mode: details.mode, confidence: details.confidence });
  }
  return [...byId.values()];
}

function scoreAccuracy(score: ScorePayload) { return score.accuracy ?? accuracyFromMisses(score.beatmapNotes ?? null, score.misses ?? null); }

async function getOverrides(userId: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ system: EditablePointSystem; points: number }>>('SELECT "system","points" FROM "UserPointOverride" WHERE "userId"=$1', userId);
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

export async function syncUserModeScores(userId: string) {
  const [profile, user, overrides, baseline, config] = await Promise.all([
    prisma.rhythiaProfile.findUnique({ where: { userId }, select: { profileId: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { rhp: true } }),
    getOverrides(userId),
    ensureRankingBaseline(userId),
    loadRankingConfig(),
  ]);
  if (!profile || !user) return { rpl: 0, rps: 0, rpv: 0, rhp: user?.rhp ?? 0, rows: [] as RhythiaModeScoreRow[], foundModes: { lock: 0, spin: 0, vr: 0 }, added: 0, rankIndex: 0 };
  const maps = await prisma.challengeMap.findMany({ where: { status: "approved", rating: { not: null }, OR: [{ reviewerNote: null }, { reviewerNote: { not: UNRANKED_MARKER } }] }, select: { id: true, title: true, sourceBeatmapId: true, rating: true } });
  const scores = await fetchModeScores(profile.profileId);
  const byBeatmapId = new Map<number, (typeof maps)[number]>();
  const byTitle = new Map<string, (typeof maps)[number]>();
  for (const map of maps) { if (map.sourceBeatmapId != null) byBeatmapId.set(map.sourceBeatmapId, map); byTitle.set(normalize(map.title), map); }
  const best = new Map<string, { score: ScorePayload; mode: ModeKey; map: (typeof maps)[number]; points: number }>();
  for (const entry of scores) {
    if (entry.score.passed !== true) continue;
    const beatmapId = entry.score.beatmapId ?? entry.score.mapId ?? null;
    const map = beatmapId != null ? byBeatmapId.get(beatmapId) ?? byTitle.get(normalize(entry.score.beatmapTitle)) : byTitle.get(normalize(entry.score.beatmapTitle));
    if (!map) continue;
    const points = pointsForModeScore(entry.score, entry.mode, map.rating);
    if (points <= 0) continue;
    const mapKey = map.sourceBeatmapId != null ? `rhythia:${map.sourceBeatmapId}` : `map:${map.id}`;
    const key = `${mapKey}:${entry.mode}`;
    const candidate = { score: entry.score, mode: entry.mode, map, points };
    const existing = best.get(key);
    if (!existing || points > existing.points || (points === existing.points && (entry.score.awarded_sp ?? 0) > (existing.score.awarded_sp ?? 0)) || (points === existing.points && (entry.score.awarded_sp ?? 0) === (existing.score.awarded_sp ?? 0) && String(entry.score.created_at ?? "") > String(existing.score.created_at ?? ""))) best.set(key, candidate);
  }
  const rows = [...best.values()].map((entry) => { const mapKey = entry.map.sourceBeatmapId != null ? `rhythia:${entry.map.sourceBeatmapId}` : `map:${entry.map.id}`; return { mapKey, mapTitle: entry.map.title, scoreId: entry.score.id, cameraMode: entry.mode, points: entry.points, accuracy: scoreAccuracy(entry.score), awardedSp: entry.score.awarded_sp ?? null }; });
  const oldRows = await prisma.rhythiaModeScore.findMany({ where: { userId }, select: { scoreId: true, cameraMode: true, mapKey: true } });
  const previousKeys = new Set(oldRows.map((row) => `${row.mapKey}:${row.cameraMode}:${row.scoreId}`));
  const added = rows.filter((row) => !previousKeys.has(`${row.mapKey}:${row.cameraMode}:${row.scoreId}`)).length;
  const rawTotals: ModePoints = { lock: 0, spin: 0, vr: 0 };
  for (const row of rows) rawTotals[row.cameraMode] += row.points;
  const calculated: ModePoints = { lock: baseline.rplBase + rawTotals.lock, spin: baseline.rpsBase + rawTotals.spin, vr: baseline.rpvBase + rawTotals.vr };
  const totals: ModePoints = { lock: overrides.get("rpl") ?? calculated.lock, spin: overrides.get("rps") ?? calculated.spin, vr: overrides.get("rpv") ?? calculated.vr };
  const totalRhp = overrides.get("rhp") ?? overallRhpFromModes(totals, baseline.overallFloor, config);
  await prisma.$transaction(async (tx) => { await tx.rhythiaModeScore.deleteMany({ where: { userId } }); if (rows.length) await tx.rhythiaModeScore.createMany({ data: rows.map((row) => ({ userId, ...row })) }); await tx.user.update({ where: { id: userId }, data: { rhp: totalRhp, scoreImportDone: true, lastRhythiaRpCheckAt: new Date() } }); });
  return { rpl: totals.lock, rps: totals.spin, rpv: totals.vr, rhp: totalRhp, rows: rows.map((row) => ({ id: `${row.scoreId}-${row.cameraMode}`, ...row })) as RhythiaModeScoreRow[], foundModes: { lock: rows.filter((row) => row.cameraMode === "lock").length, spin: rows.filter((row) => row.cameraMode === "spin").length, vr: rows.filter((row) => row.cameraMode === "vr").length }, added, rankIndex: modeRankInfo(totals.lock, "lock").index, raw: rawTotals };
}

export async function getModeScoreMap(userId: string) {
  const rows = await prisma.rhythiaModeScore.findMany({ where: { userId }, select: { mapKey: true, mapTitle: true, cameraMode: true, points: true } });
  const result: Record<string, ModePoints> = {};
  for (const row of rows) { const key = normalize(row.mapTitle); if (!key) continue; result[key] ??= { lock: 0, spin: 0, vr: 0 }; result[key][row.cameraMode] = Math.max(result[key][row.cameraMode], row.points); }
  return result;
}

export async function getModeLeaderboard(mode: ModeKey, limit = 100) {
  const system = mode === "lock" ? "rpl" : mode === "spin" ? "rps" : "rpv";
  const baseColumn = mode === "lock" ? '"rplBase"' : mode === "spin" ? '"rpsBase"' : '"rpvBase"';
  const rows = await prisma.$queryRawUnsafe<Array<{ userId: string; username: string; displayName: string | null; profileHandle: string; avatar: string | null; points: number }>>(`SELECT u.id AS "userId",u.username,u."displayName",u."profileHandle",u.avatar,COALESCE(o.points,COALESCE(b.${baseColumn},0)+COALESCE(SUM(r.points),0),0)::int AS points FROM "User" u LEFT JOIN "RhythiaModeScore" r ON r."userId"=u.id AND r."cameraMode"=$1 LEFT JOIN "UserPointOverride" o ON o."userId"=u.id AND o.system=$2 LEFT JOIN "RankingBaseline" b ON b."userId"=u.id WHERE u."profileHandle" <> 'rhythia-imports' AND (r."userId" IS NOT NULL OR o."userId" IS NOT NULL OR b."userId" IS NOT NULL) GROUP BY u.id,o."userId",o.points,b."userId",b.${baseColumn} ORDER BY points DESC,u.username ASC LIMIT $3`, mode, system, limit);
  return rows.map((row, index) => ({ ...row, position: index + 1, rankInfo: modeRankInfo(row.points, mode) }));
}

export function modePointsForDisplay(rows: RhythiaModeScoreRow[]) { const totals: ModePoints = { lock: 0, spin: 0, vr: 0 }; for (const row of rows) totals[row.cameraMode] += row.points; return totals; }
