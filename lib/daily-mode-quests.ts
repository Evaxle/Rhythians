import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { startOfDayUTC } from "@/lib/daily";
import { rhythiaRequest } from "@/lib/rhythia";
import { speedProfileAt, MAP_ANALYZER_VERSION, type MapSpeedProfile } from "@/lib/map-difficulty";
import { modeRankInfo } from "@/lib/mode-ranks";
import { calculateStoredTotals, reconcileUserRankPoints, syncUserModeScores } from "@/lib/rhythia-mode-points";
import type { ModeKey } from "@/lib/rhythia-mode-rules";

export const DAILY_QUEST_MULTIPLIER = 1.3;
const MODES: ModeKey[] = ["lock", "spin", "vr"];

type QuestMap = { id: string; title: string; artist: string | null; mapperName: string | null; imageUrl: string | null; sourceUrl: string | null; mapFileUrl: string; sourceBeatmapId: number | null; rating: number; rpl: number; rps: number; rpv: number; speedProfiles: unknown };
type QuestRow = { id: string; date: Date; userId: string; mode: string; mapId: string };
type ClaimRow = { id: string; date: Date; userId: string; questId: string; mode: string; mapId: string; scoreId: number; basePoints: number; bonusPoints: number; createdAt: Date };
type FlagValue = boolean | number | string | null;
type ScorePayload = { id: number; beatmapTitle?: string | null; beatmapId?: number | null; mapId?: number | null; passed?: FlagValue; speed?: number | null; created_at?: string | null; cameraMode?: string | null; gameMode?: string | null; mode?: string | null; spin?: FlagValue; vr?: FlagValue; isVr?: FlagValue; mods?: string | string[] | null };
type ScoreBucket = { name: "lastDay" | "top" | "vrTop" | "vrRecent"; scores: ScorePayload[] };

function normalize(value: string | null | undefined) { return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function sourceId(value: number) { return Number.isSafeInteger(value) && value > 0x7fffffff && value <= 0xffffffff ? value - 0x100000000 : value; }
function enabled(value: FlagValue | undefined) {
  if (value === true || value === 1) return true;
  if (typeof value === "string") return ["true", "1", "yes", "on", "vr", "spin"].includes(value.trim().toLowerCase());
  return false;
}
function modsText(value: ScorePayload["mods"]) { return Array.isArray(value) ? value.join(" ") : value ?? ""; }
function parseProfiles(value: unknown): MapSpeedProfile[] {
  if (Array.isArray(value)) return value as MapSpeedProfile[];
  if (typeof value === "string") { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed as MapSpeedProfile[] : []; } catch { return []; } }
  return [];
}
function modeFor(score: ScorePayload, bucket: ScoreBucket["name"]): ModeKey {
  const explicit = `${score.cameraMode ?? ""} ${score.gameMode ?? ""} ${score.mode ?? ""}`.toLowerCase();
  const mods = modsText(score.mods);
  if (explicit.includes("vr") || explicit.includes("virtual reality") || enabled(score.vr) || enabled(score.isVr) || /(^|[\s,;+])vr([\s,;+]|$)/i.test(mods) || /virtual\s*reality/i.test(mods) || bucket === "vrTop" || bucket === "vrRecent") return "vr";
  if (explicit.includes("spin") || enabled(score.spin) || /(^|[\s,;+])spin([\s,;+]|$)/i.test(mods)) return "spin";
  return "lock";
}
function baseReward(map: QuestMap, mode: ModeKey, speed: number) {
  const profile = speedProfileAt(parseProfiles(map.speedProfiles), speed);
  if (profile) return profile.rewards[mode];
  if (mode === "lock") return map.rpl;
  if (mode === "spin") return map.rps;
  return map.rpv;
}
function mapKey(map: Pick<QuestMap, "id" | "sourceBeatmapId">) { return map.sourceBeatmapId != null ? `rhythia:${map.sourceBeatmapId}` : `map:${map.id}`; }
function seededIndex(userId: string, date: Date, mode: ModeKey, length: number) {
  if (length <= 1) return 0;
  const digest = createHash("sha256").update(`${userId}:${date.toISOString().slice(0, 10)}:${mode}`).digest();
  return digest.readUInt32LE(0) % length;
}

export async function ensureDailyModeQuestTables() {
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "DailyModeQuest" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "date" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "mode" TEXT NOT NULL CHECK ("mode" IN ('lock','spin','vr')),
    "mapId" TEXT NOT NULL REFERENCES "ChallengeMap"("id") ON DELETE CASCADE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE ("date","userId","mode")
  )`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "DailyModeQuestClaim" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "date" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "questId" UUID NOT NULL REFERENCES "DailyModeQuest"("id") ON DELETE CASCADE,
    "mode" TEXT NOT NULL CHECK ("mode" IN ('lock','spin','vr')),
    "mapId" TEXT NOT NULL REFERENCES "ChallengeMap"("id") ON DELETE CASCADE,
    "scoreId" INTEGER NOT NULL,
    "basePoints" INTEGER NOT NULL,
    "bonusPoints" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE ("date","userId")
  )`);
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "DailyModeQuest_user_date_idx" ON "DailyModeQuest"("userId","date")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "DailyModeQuestClaim_user_idx" ON "DailyModeQuestClaim"("userId")');
}

async function eligibleMaps() {
  return prisma.$queryRawUnsafe<QuestMap[]>(`
    SELECT c.id,c.title,c.artist,c."mapperName",c."imageUrl",c."sourceUrl",c."mapFileUrl",c."sourceBeatmapId",a.rating,a.rpl,a.rps,a.rpv,a."speedProfiles"
    FROM "ChallengeMap" c JOIN "MapDifficultyAnalysis" a ON a."mapId"=c.id
    WHERE c.status='approved' AND a.status='analyzed' AND a."pointEligible"=TRUE AND a."analyzerVersion"=$1 AND a.rating IS NOT NULL
    ORDER BY a.rating ASC,c.id ASC`, MAP_ANALYZER_VERSION);
}

async function questMapsByIds(ids: string[]) {
  const maps: QuestMap[] = [];
  for (const id of ids) {
    const rows = await prisma.$queryRawUnsafe<QuestMap[]>(`
      SELECT c.id,c.title,c.artist,c."mapperName",c."imageUrl",c."sourceUrl",c."mapFileUrl",c."sourceBeatmapId",a.rating,a.rpl,a.rps,a.rpv,a."speedProfiles"
      FROM "ChallengeMap" c JOIN "MapDifficultyAnalysis" a ON a."mapId"=c.id
      WHERE c.id=$1 AND a.status='analyzed' AND a."pointEligible"=TRUE AND a."analyzerVersion"=$2 LIMIT 1`, id, MAP_ANALYZER_VERSION);
    if (rows[0]) maps.push(rows[0]);
  }
  return maps;
}

async function createTodayQuests(userId: string, date: Date) {
  const existing = await prisma.$queryRawUnsafe<QuestRow[]>('SELECT * FROM "DailyModeQuest" WHERE "userId"=$1 AND "date"=$2 ORDER BY mode', userId, date);
  if (existing.length === 3) return existing;
  const [maps, totals, stored] = await Promise.all([
    eligibleMaps(),
    calculateStoredTotals(userId),
    prisma.rhythiaModeScore.findMany({ where: { userId }, select: { mapKey: true, cameraMode: true } }),
  ]);
  if (!maps.length) return existing;
  const used = new Set(existing.map((row) => row.mapId));
  for (const mode of MODES) {
    if (existing.some((row) => row.mode === mode)) continue;
    const points = mode === "lock" ? totals.rpl : mode === "spin" ? totals.rps : totals.rpv;
    const rank = modeRankInfo(points, mode);
    const cleared = new Set(stored.filter((row) => row.cameraMode === mode).map((row) => row.mapKey));
    const inRange = maps.filter((map) => map.rating >= rank.rangeMin && map.rating <= rank.rangeMax && !used.has(map.id));
    const fresh = inRange.filter((map) => !cleared.has(mapKey(map)));
    const pool = fresh.length ? fresh : inRange.length ? inRange : maps.filter((map) => !used.has(map.id));
    if (!pool.length) continue;
    const selected = pool[seededIndex(userId, date, mode, pool.length)];
    await prisma.$executeRawUnsafe('INSERT INTO "DailyModeQuest" ("date","userId",mode,"mapId") VALUES ($1,$2,$3,$4) ON CONFLICT ("date","userId",mode) DO NOTHING', date, userId, mode, selected.id);
    used.add(selected.id);
  }
  return prisma.$queryRawUnsafe<QuestRow[]>('SELECT * FROM "DailyModeQuest" WHERE "userId"=$1 AND "date"=$2 ORDER BY mode', userId, date);
}

async function recentScores(userId: string) {
  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId }, select: { profileId: true } });
  if (!profile) return [] as Array<{ score: ScorePayload; mode: ModeKey; recent: boolean }>;
  const data = await rhythiaRequest<Partial<Record<ScoreBucket["name"], ScorePayload[]>>>("getUserScores", { id: profile.profileId, limit: 500 });
  const buckets: ScoreBucket[] = [{ name: "lastDay", scores: data.lastDay ?? [] }, { name: "top", scores: data.top ?? [] }, { name: "vrTop", scores: data.vrTop ?? [] }, { name: "vrRecent", scores: data.vrRecent ?? [] }];
  const best = new Map<number, { score: ScorePayload; mode: ModeKey; recent: boolean; confidence: number }>();
  for (const bucket of buckets) for (const score of bucket.scores) {
    if (!score || typeof score.id !== "number" || !enabled(score.passed)) continue;
    const mode = modeFor(score, bucket.name);
    const explicit = Boolean(score.cameraMode || score.gameMode || score.mode || enabled(score.spin) || enabled(score.vr) || enabled(score.isVr) || modsText(score.mods));
    const confidence = bucket.name === "vrTop" || bucket.name === "vrRecent" ? 2 : explicit ? 3 : 1;
    const recent = bucket.name === "lastDay" || bucket.name === "vrRecent";
    const old = best.get(score.id);
    if (!old || confidence > old.confidence || recent && !old.recent) best.set(score.id, { score, mode, recent, confidence });
  }
  return [...best.values()];
}

function scoreMatchesQuest(entry: { score: ScorePayload; mode: ModeKey; recent: boolean }, map: QuestMap, mode: ModeKey, date: Date) {
  if (entry.mode !== mode || !enabled(entry.score.passed)) return false;
  const rawId = entry.score.beatmapId ?? entry.score.mapId ?? null;
  const idMatches = rawId != null && map.sourceBeatmapId != null && sourceId(rawId) === map.sourceBeatmapId;
  const titleMatches = normalize(entry.score.beatmapTitle) === normalize(map.title);
  if (!idMatches && !titleMatches) return false;
  if (entry.score.created_at) {
    const created = new Date(entry.score.created_at);
    if (Number.isFinite(created.getTime())) return created >= date;
  }
  return entry.recent;
}

export async function getDailyModeQuests(userId: string, checkScores = false) {
  await ensureDailyModeQuestTables();
  const date = startOfDayUTC();
  const rows = await createTodayQuests(userId, date);
  const claimRows = await prisma.$queryRawUnsafe<ClaimRow[]>('SELECT * FROM "DailyModeQuestClaim" WHERE "userId"=$1 AND "date"=$2 LIMIT 1', userId, date);
  const claim = claimRows[0] ?? null;
  const maps = await questMapsByIds(rows.map((row) => row.mapId));
  const mapById = new Map(maps.map((map) => [map.id, map]));
  const scores = checkScores && !claim ? await recentScores(userId) : [];
  return rows.map((row) => {
    const map = mapById.get(row.mapId);
    if (!map) return null;
    const mode = row.mode as ModeKey;
    const detected = claim?.questId === row.id || scores.some((entry) => scoreMatchesQuest(entry, map, mode, date));
    const base = baseReward(map, mode, 1);
    return {
      id: row.id,
      mode,
      map: { id: map.id, title: map.title, artist: map.artist, mapperName: map.mapperName, imageUrl: map.imageUrl, sourceUrl: map.sourceUrl, mapFileUrl: map.mapFileUrl, rating: map.rating },
      basePoints: base,
      boostedPoints: Math.round(base * DAILY_QUEST_MULTIPLIER),
      bonusPoints: Math.round(base * (DAILY_QUEST_MULTIPLIER - 1)),
      detected,
      claimed: claim?.questId === row.id,
      claimLocked: Boolean(claim && claim.questId !== row.id),
    };
  }).filter((row): row is NonNullable<typeof row> => row !== null);
}

export async function claimDailyModeQuest(userId: string, questId: string) {
  await ensureDailyModeQuestTables();
  const date = startOfDayUTC();
  const existing = await prisma.$queryRawUnsafe<ClaimRow[]>('SELECT * FROM "DailyModeQuestClaim" WHERE "userId"=$1 AND "date"=$2 LIMIT 1', userId, date);
  if (existing[0]) throw new Error("You already claimed one of today's three mode quests.");
  const questRows = await prisma.$queryRawUnsafe<QuestRow[]>('SELECT * FROM "DailyModeQuest" WHERE id=$1::uuid AND "userId"=$2 AND "date"=$3 LIMIT 1', questId, userId, date);
  const quest = questRows[0];
  if (!quest) throw new Error("Daily quest not found.");
  const maps = await questMapsByIds([quest.mapId]);
  const map = maps[0];
  if (!map) throw new Error("This quest map is not currently eligible for rank points.");
  const scores = await recentScores(userId);
  const mode = quest.mode as ModeKey;
  const matches = scores.filter((entry) => scoreMatchesQuest(entry, map, mode, date));
  if (!matches.length) throw new Error(`No passing ${mode === "lock" ? "Lock" : mode === "spin" ? "Spin" : "VR"} score from today was detected for this quest map.`);
  matches.sort((a, b) => {
    const at = a.score.created_at ? new Date(a.score.created_at).getTime() : 0;
    const bt = b.score.created_at ? new Date(b.score.created_at).getTime() : 0;
    return bt - at || b.score.id - a.score.id;
  });
  const score = matches[0].score;
  const speed = Number.isFinite(score.speed) && (score.speed ?? 0) > 0 ? score.speed! : 1;
  const basePoints = baseReward(map, mode, speed);
  const bonusPoints = Math.max(1, Math.round(basePoints * (DAILY_QUEST_MULTIPLIER - 1)));
  await syncUserModeScores(userId);
  await prisma.$executeRawUnsafe(`INSERT INTO "DailyModeQuestClaim" ("date","userId","questId",mode,"mapId","scoreId","basePoints","bonusPoints") VALUES ($1,$2,$3::uuid,$4,$5,$6,$7,$8)`, date, userId, quest.id, mode, map.id, score.id, basePoints, bonusPoints);
  const totals = await reconcileUserRankPoints(userId);
  await prisma.notification.create({ data: { userId, type: "rhp_earned", title: "Daily quest claimed", message: `Your ${mode === "lock" ? "RPL" : mode === "spin" ? "RPS" : "RPV"} quest clear received a 1.3× boost (+${bonusPoints}).`, url: "/daily" } });
  return { mode, basePoints, bonusPoints, boostedPoints: basePoints + bonusPoints, totals };
}
