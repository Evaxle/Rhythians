import { prisma } from "@/lib/db";
import { rhythiaRequest } from "@/lib/rhythia";
import { accuracyFromMisses, accuracyMultiplier, RANKS, type RankInfo } from "@/lib/ranks";

export const MODE_RULES = {
  lock: { key: "lock", label: "Lock", short: "RPL", maxPoints: 25, tierSpan: 100 },
  spin: { key: "spin", label: "Spin", short: "RPS", maxPoints: 30, tierSpan: 90 },
  vr: { key: "vr", label: "VR", short: "RPV", maxPoints: 23, tierSpan: 92 },
} as const;

export type ModeKey = keyof typeof MODE_RULES;
export type ModePoints = { lock: number; spin: number; vr: number };
export type RhythiaModeScoreRow = { id: string; mapKey: string; mapTitle: string; scoreId: number; cameraMode: ModeKey; points: number; accuracy: number | null; awardedSp: number | null };
type ScorePayload = { id: number; beatmapTitle?: string | null; beatmapId?: number | null; mapId?: number | null; beatmapHash?: string | null; passed?: boolean | null; misses?: number | null; beatmapNotes?: number | null; accuracy?: number | null; speed?: number | null; awarded_sp?: number | null; created_at?: string | null; cameraMode?: string | null; gameMode?: string | null; mode?: string | null; spin?: boolean | null; vr?: boolean | null; isVr?: boolean | null; mods?: string | null };
type ScoreBucket = { name: "lastDay" | "top" | "vrTop" | "vrRecent"; scores: ScorePayload[] };
const UNRANKED_MARKER = "rhythia-unranked";

function normalize(value: string | null | undefined) { return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

export function modeRankInfo(points: number, mode: ModeKey): RankInfo {
  const rule = MODE_RULES[mode]; const safe = Math.max(0, Math.floor(points)); const rankSpan = rule.tierSpan * 5; const index = Math.min(RANKS.length - 1, Math.floor(safe / rankSpan)); const rank = RANKS[index]; const within = safe - index * rankSpan; const tier = Math.min(5, Math.floor(within / rule.tierSpan) + 1); const tierStart = index * rankSpan + Math.min(4, Math.floor(within / rule.tierSpan)) * rule.tierSpan; const tierEnd = Math.min(tierStart + rule.tierSpan, index * rankSpan + rankSpan); const nextTierStart = Math.min(index * rankSpan + tier * rule.tierSpan, index * rankSpan + rankSpan); const progressToNextTier = Math.min(1, Math.max(0, (safe - tierStart) / rule.tierSpan)); const nextRankStart = index < RANKS.length - 1 ? (index + 1) * rankSpan : null; return { index, name: rank.name, tier, isExpert: index === RANKS.length - 1, minRhp: index * rankSpan, maxRhp: index < RANKS.length - 1 ? (index + 1) * rankSpan : null, tierStart, tierEnd, nextTierStart, nextRankStart, color: rank.color, progressToNextTier, rangeMin: rank.rangeMin, rangeMax: rank.rangeMax };
}

export function modeRankLabel(points: number, mode: ModeKey) { const info = modeRankInfo(points, mode); return info.isExpert ? "Expert" : `${info.name} ${info.tier}`; }

export function scoreCameraMode(score: ScorePayload, sourceBucket: ScoreBucket["name"]): ModeKey { const explicit = [score.cameraMode, score.gameMode, score.mode].find((value) => typeof value === "string")?.toLowerCase() ?? ""; if (explicit === "vr" || explicit === "virtualreality" || explicit === "virtual-reality") return "vr"; if (explicit === "spin") return "spin"; if (explicit === "lock") return "lock"; if (sourceBucket === "vrTop" || sourceBucket === "vrRecent" || score.vr === true || score.isVr === true) return "vr"; if (score.spin === true) return "spin"; if (typeof score.mods === "string" && /(^|[\s,;+])spin([\s,;+]|$)/i.test(score.mods)) return "spin"; return "lock"; }

export function pointsForModeScore(score: ScorePayload, mode: ModeKey) { if (score.passed !== true) return 0; const rule = MODE_RULES[mode]; const accuracy = score.accuracy ?? accuracyFromMisses(score.beatmapNotes ?? null, score.misses ?? null); const multiplier = accuracy == null ? 1 : accuracyMultiplier(accuracy); return Math.max(1, Math.min(rule.maxPoints, Math.round(rule.maxPoints * multiplier))); }

async function fetchModeScores(profileId: number) { const data = await rhythiaRequest<Partial<Record<ScoreBucket["name"], ScorePayload[]>>>("getUserScores", { id: profileId, limit: 100 }); const buckets: ScoreBucket[] = [{ name: "lastDay", scores: data.lastDay ?? [] }, { name: "top", scores: data.top ?? [] }, { name: "vrTop", scores: data.vrTop ?? [] }, { name: "vrRecent", scores: data.vrRecent ?? [] }]; const byId = new Map<number, { score: ScorePayload; mode: ModeKey }>(); for (const bucket of buckets) for (const score of bucket.scores) { if (!score || typeof score.id !== "number") continue; const mode = scoreCameraMode(score, bucket.name); const existing = byId.get(score.id); if (!existing || (existing.mode !== "vr" && mode === "vr") || (existing.mode === "lock" && mode === "spin")) byId.set(score.id, { score, mode }); } return [...byId.values()]; }
function scoreAccuracy(score: ScorePayload) { return score.accuracy ?? accuracyFromMisses(score.beatmapNotes ?? null, score.misses ?? null); }

export async function syncUserModeScores(userId: string) {
  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId }, select: { profileId: true } });
  if (!profile) return { rpl: 0, rps: 0, rpv: 0, rhp: 0, rows: [] as RhythiaModeScoreRow[], foundModes: { lock: 0, spin: 0, vr: 0 }, added: 0 };
  const [maps, scores, transactions] = await Promise.all([
    prisma.challengeMap.findMany({ where: { status: "approved", rating: { not: null }, OR: [{ reviewerNote: null }, { reviewerNote: { not: UNRANKED_MARKER } }] }, select: { id: true, title: true, sourceBeatmapId: true } }),
    fetchModeScores(profile.profileId),
    prisma.rhpTransaction.aggregate({ where: { userId, NOT: { reason: { in: ["challenge_map", "challenge_map_fail", "ranked_map"] } } }, _sum: { amount: true } }),
  ]);
  const byBeatmapId = new Map<number, (typeof maps)[number]>(); const byTitle = new Map<string, (typeof maps)[number]>(); for (const map of maps) { if (map.sourceBeatmapId != null) byBeatmapId.set(map.sourceBeatmapId, map); byTitle.set(normalize(map.title), map); }
  const best = new Map<string, { score: ScorePayload; mode: ModeKey; map: (typeof maps)[number]; points: number }>();
  for (const entry of scores) { if (entry.score.passed !== true) continue; const beatmapId = entry.score.beatmapId ?? entry.score.mapId ?? null; const map = beatmapId != null ? byBeatmapId.get(beatmapId) ?? byTitle.get(normalize(entry.score.beatmapTitle)) : byTitle.get(normalize(entry.score.beatmapTitle)); if (!map) continue; const points = pointsForModeScore(entry.score, entry.mode); if (points <= 0) continue; const mapKey = map.sourceBeatmapId != null ? `rhythia:${map.sourceBeatmapId}` : `map:${map.id}`; const key = `${mapKey}:${entry.mode}`; const candidate = { score: entry.score, mode: entry.mode, map, points }; const existing = best.get(key); if (!existing || points > existing.points || (points === existing.points && (entry.score.awarded_sp ?? 0) > (existing.score.awarded_sp ?? 0))) best.set(key, candidate); }
  const rows = [...best.values()].map((entry) => { const mapKey = entry.map.sourceBeatmapId != null ? `rhythia:${entry.map.sourceBeatmapId}` : `map:${entry.map.id}`; return { mapKey, mapTitle: entry.map.title, scoreId: entry.score.id, cameraMode: entry.mode, points: entry.points, accuracy: scoreAccuracy(entry.score), awardedSp: entry.score.awarded_sp ?? null, speed: entry.score.speed ?? null }; });
  const oldRows = await prisma.rhythiaModeScore.findMany({ where: { userId }, select: { scoreId: true, cameraMode: true, mapKey: true } }); const previousKeys = new Set(oldRows.map((row) => `${row.mapKey}:${row.cameraMode}:${row.scoreId}`)); const added = rows.filter((row) => !previousKeys.has(`${row.mapKey}:${row.cameraMode}:${row.scoreId}`)).length; const totals: ModePoints = { lock: 0, spin: 0, vr: 0 }; for (const row of rows) totals[row.cameraMode] += row.points; const legacyRhp = transactions._sum.amount ?? 0; const totalRhp = Math.max(0, legacyRhp + totals.lock + totals.spin + totals.vr);
  await prisma.$transaction(async (tx) => { await tx.rhythiaModeScore.deleteMany({ where: { userId } }); if (rows.length > 0) await tx.rhythiaModeScore.createMany({ data: rows.map((row) => ({ userId, ...row })) }); await tx.user.update({ where: { id: userId }, data: { rhp: totalRhp, scoreImportDone: true, lastRhythiaRpCheckAt: new Date() } }); });
  const responseRows = rows.map((row) => ({ id: `${row.scoreId}-${row.cameraMode}`, ...row })) as RhythiaModeScoreRow[]; return { rpl: totals.lock, rps: totals.spin, rpv: totals.vr, rhp: totalRhp, rows: responseRows, foundModes: { lock: rows.filter((row) => row.cameraMode === "lock").length, spin: rows.filter((row) => row.cameraMode === "spin").length, vr: rows.filter((row) => row.cameraMode === "vr").length }, added };
}

export async function getModeScoreMap(userId: string) { const rows = await prisma.rhythiaModeScore.findMany({ where: { userId }, select: { mapKey: true, mapTitle: true, cameraMode: true, points: true } }); const result: Record<string, ModePoints> = {}; for (const row of rows) { const key = normalize(row.mapTitle); if (!key) continue; result[key] ??= { lock: 0, spin: 0, vr: 0 }; result[key][row.cameraMode] = Math.max(result[key][row.cameraMode], row.points); } return result; }

export async function getModeLeaderboard(mode: ModeKey, limit = 100) { const grouped = await prisma.rhythiaModeScore.groupBy({ by: ["userId"], where: { cameraMode: mode }, _sum: { points: true }, orderBy: { _sum: { points: "desc" } }, take: limit }); if (grouped.length === 0) return []; const users = await prisma.user.findMany({ where: { id: { in: grouped.map((entry) => entry.userId) } }, select: { id: true, username: true, displayName: true, profileHandle: true, avatar: true } }); const userMap = new Map(users.map((user) => [user.id, user])); return grouped.map((entry, index) => { const user = userMap.get(entry.userId); const points = entry._sum.points ?? 0; return user ? { position: index + 1, userId: user.id, username: user.username, displayName: user.displayName, profileHandle: user.profileHandle, avatar: user.avatar, points, rankInfo: modeRankInfo(points, mode) } : null; }).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)); }

export function modePointsForDisplay(rows: RhythiaModeScoreRow[]) { const totals: ModePoints = { lock: 0, spin: 0, vr: 0 }; for (const row of rows) totals[row.cameraMode] += row.points; return totals; }
