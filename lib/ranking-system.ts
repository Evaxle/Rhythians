import { prisma } from "@/lib/db";
import { getRankInfo, RANKS, rankTierBounds } from "@/lib/ranks";
import { MODE_RULES, type ModeKey, type ModePoints } from "@/lib/rhythia-mode-rules";

export const RANKING_CONFIG_KEY = "rankingConfigV2";

export type RankingConfig = {
  version: 2;
  rpWeight: number;
  expertFloor: number;
  experiencedFloor: number;
  intermediateFloor: number;
  beginnerFloor: number;
  unrankedRpWeight: number;
  maxPlacementRhp: number;
  modeFallbackFraction: number;
  strongestModeWeight: number;
  secondModeWeight: number;
  thirdModeWeight: number;
};

export const DEFAULT_RANKING_CONFIG: RankingConfig = {
  version: 2,
  rpWeight: 0.65,
  expertFloor: 8000,
  experiencedFloor: 6500,
  intermediateFloor: 3000,
  beginnerFloor: 0,
  unrankedRpWeight: 0.55,
  maxPlacementRhp: 15000,
  modeFallbackFraction: 0.4,
  strongestModeWeight: 0.75,
  secondModeWeight: 0.2,
  thirdModeWeight: 0.05,
};

function finite(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function sanitizeRankingConfig(value: unknown): RankingConfig {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const config: RankingConfig = {
    version: 2,
    rpWeight: Math.min(1, Math.max(0, finite(source.rpWeight, DEFAULT_RANKING_CONFIG.rpWeight))),
    expertFloor: Math.max(0, Math.round(finite(source.expertFloor, DEFAULT_RANKING_CONFIG.expertFloor))),
    experiencedFloor: Math.max(0, Math.round(finite(source.experiencedFloor, DEFAULT_RANKING_CONFIG.experiencedFloor))),
    intermediateFloor: Math.max(0, Math.round(finite(source.intermediateFloor, DEFAULT_RANKING_CONFIG.intermediateFloor))),
    beginnerFloor: Math.max(0, Math.round(finite(source.beginnerFloor, DEFAULT_RANKING_CONFIG.beginnerFloor))),
    unrankedRpWeight: Math.min(1, Math.max(0, finite(source.unrankedRpWeight, DEFAULT_RANKING_CONFIG.unrankedRpWeight))),
    maxPlacementRhp: Math.max(RANKS[RANKS.length - 1].minRhp, Math.round(finite(source.maxPlacementRhp, DEFAULT_RANKING_CONFIG.maxPlacementRhp))),
    modeFallbackFraction: Math.min(1, Math.max(0, finite(source.modeFallbackFraction, DEFAULT_RANKING_CONFIG.modeFallbackFraction))),
    strongestModeWeight: Math.max(0, finite(source.strongestModeWeight, DEFAULT_RANKING_CONFIG.strongestModeWeight)),
    secondModeWeight: Math.max(0, finite(source.secondModeWeight, DEFAULT_RANKING_CONFIG.secondModeWeight)),
    thirdModeWeight: Math.max(0, finite(source.thirdModeWeight, DEFAULT_RANKING_CONFIG.thirdModeWeight)),
  };
  const total = config.strongestModeWeight + config.secondModeWeight + config.thirdModeWeight;
  if (total <= 0) return { ...config, strongestModeWeight: 0.75, secondModeWeight: 0.2, thirdModeWeight: 0.05 };
  return { ...config, strongestModeWeight: config.strongestModeWeight / total, secondModeWeight: config.secondModeWeight / total, thirdModeWeight: config.thirdModeWeight / total };
}

export async function loadRankingConfig(): Promise<RankingConfig> {
  const rows = await prisma.$queryRawUnsafe<Array<{ value: string }>>('SELECT value FROM "SiteSetting" WHERE key=$1 LIMIT 1', RANKING_CONFIG_KEY);
  if (!rows[0]?.value) return DEFAULT_RANKING_CONFIG;
  try { return sanitizeRankingConfig(JSON.parse(rows[0].value)); } catch { return DEFAULT_RANKING_CONFIG; }
}

export async function saveRankingConfig(value: unknown) {
  const config = sanitizeRankingConfig(value);
  await prisma.$executeRawUnsafe('INSERT INTO "SiteSetting" (key,value,"updatedAt") VALUES ($1,$2,CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value,"updatedAt"=CURRENT_TIMESTAMP', RANKING_CONFIG_KEY, JSON.stringify(config));
  return config;
}

export function placementFloor(globalRank: number | null | undefined, config: RankingConfig) {
  if (globalRank == null || !Number.isFinite(globalRank) || globalRank <= 0) return 0;
  if (globalRank <= 500) return config.expertFloor;
  if (globalRank <= 1000) return config.experiencedFloor;
  if (globalRank <= 5000) return config.intermediateFloor;
  return config.beginnerFloor;
}

export function initialOverallPlacement(input: { globalRank?: number | null; rhythmPoints?: number | null }, config: RankingConfig) {
  const rp = Math.max(0, Number(input.rhythmPoints) || 0);
  const hasRank = input.globalRank != null && Number.isFinite(input.globalRank) && Number(input.globalRank) > 0;
  const rpPlacement = rp * (hasRank ? config.rpWeight : config.unrankedRpWeight);
  return Math.min(config.maxPlacementRhp, Math.max(placementFloor(input.globalRank, config), Math.round(rpPlacement)));
}

export function modeScale(mode: ModeKey) { return MODE_RULES[mode].rankScale; }
export function modeEquivalentRhp(points: number, mode: ModeKey) { return Math.max(0, points) / modeScale(mode); }
export function modePointsFromEquivalentRhp(rhp: number, mode: ModeKey) { return Math.max(0, Math.round(rhp * modeScale(mode))); }

function weightedModeEquivalent(points: ModePoints, config: RankingConfig) {
  const equivalents = (["lock", "spin", "vr"] as ModeKey[]).map((mode) => modeEquivalentRhp(points[mode], mode)).sort((a, b) => b - a);
  return equivalents[0] * config.strongestModeWeight + equivalents[1] * config.secondModeWeight + equivalents[2] * config.thirdModeWeight;
}

export function overallRhpFromModes(points: ModePoints, overallFloor: number, config: RankingConfig) {
  const placement = Math.max(0, Math.round(overallFloor));
  const weighted = weightedModeEquivalent(points, config);
  const placementModeBaseline = placement * config.modeFallbackFraction;
  return Math.max(0, Math.round(placement + Math.max(0, weighted - placementModeBaseline)));
}

export function fallbackModeTarget(overallPlacement: number, mode: ModeKey, config: RankingConfig) {
  return modePointsFromEquivalentRhp(overallPlacement * config.modeFallbackFraction, mode);
}

export async function ensureRankingBaseline(userId: string) {
  const existing = await prisma.$queryRawUnsafe<Array<{ overallFloor: number; rplBase: number; rpsBase: number; rpvBase: number }>>('SELECT "overallFloor","rplBase","rpsBase","rpvBase" FROM "RankingBaseline" WHERE "userId"=$1 LIMIT 1', userId);
  if (existing[0]) return existing[0];
  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId }, select: { globalRank: true, rhythmPoints: true } });
  if (!profile) return { overallFloor: 0, rplBase: 0, rpsBase: 0, rpvBase: 0 };
  const config = await loadRankingConfig();
  const placement = initialOverallPlacement({ globalRank: profile.globalRank, rhythmPoints: profile.rhythmPoints }, config);
  const baseline = {
    overallFloor: placement,
    rplBase: fallbackModeTarget(placement, "lock", config),
    rpsBase: fallbackModeTarget(placement, "spin", config),
    rpvBase: fallbackModeTarget(placement, "vr", config),
  };
  await prisma.$executeRawUnsafe('INSERT INTO "RankingBaseline" ("userId","overallFloor","rplBase","rpsBase","rpvBase",source,"updatedAt") VALUES ($1,$2,$3,$4,$5,\'placement-v2-auto\',CURRENT_TIMESTAMP) ON CONFLICT ("userId") DO NOTHING', userId, baseline.overallFloor, baseline.rplBase, baseline.rpsBase, baseline.rpvBase);
  const saved = await prisma.$queryRawUnsafe<Array<{ overallFloor: number; rplBase: number; rpsBase: number; rpvBase: number }>>('SELECT "overallFloor","rplBase","rpsBase","rpvBase" FROM "RankingBaseline" WHERE "userId"=$1 LIMIT 1', userId);
  return saved[0] ?? baseline;
}

export function battleSeedForRhp(rhp: number) {
  const info = getRankInfo(rhp);
  if (info.index === 0 && info.tier === 1) return 0;
  if (info.tier > 1) return rankTierBounds(info.index, info.tier - 1).start;
  const previousIndex = Math.max(0, info.index - 1);
  return rankTierBounds(previousIndex, previousIndex === RANKS.length - 1 ? 1 : 5).start;
}

export type RankingResetPreviewRow = {
  userId: string;
  username: string;
  globalRank: number | null;
  rhythmPoints: number;
  oldRhp: number;
  newRhp: number;
  rpl: number;
  rps: number;
  rpv: number;
  battleSeed: number;
};

type PlacementSource = { userId: string; username: string; oldRhp: number; globalRank: number | null; rhythmPoints: number; rawLock: number; rawSpin: number; rawVr: number };

async function placementSources(): Promise<PlacementSource[]> {
  return prisma.$queryRawUnsafe<PlacementSource[]>(`SELECT u.id AS "userId",u.username,u.rhp AS "oldRhp",rp."globalRank",COALESCE(rp."rhythmPoints",0)::float8 AS "rhythmPoints",COALESCE(s.lock,0)::int AS "rawLock",COALESCE(s.spin,0)::int AS "rawSpin",COALESCE(s.vr,0)::int AS "rawVr"
    FROM "User" u
    LEFT JOIN "RhythiaProfile" rp ON rp."userId"=u.id
    LEFT JOIN (SELECT "userId",SUM(points) FILTER (WHERE "cameraMode"='lock') AS lock,SUM(points) FILTER (WHERE "cameraMode"='spin') AS spin,SUM(points) FILTER (WHERE "cameraMode"='vr') AS vr FROM "RhythiaModeScore" GROUP BY "userId") s ON s."userId"=u.id
    WHERE u."profileHandle" <> 'rhythia-imports' ORDER BY u.username`);
}

export async function previewRankingReset(configInput?: RankingConfig) {
  const config = configInput ?? await loadRankingConfig();
  const rows = await placementSources();
  const result: RankingResetPreviewRow[] = [];
  for (const row of rows) {
    const placement = initialOverallPlacement({ globalRank: row.globalRank, rhythmPoints: row.rhythmPoints }, config);
    const totals: ModePoints = {
      lock: fallbackModeTarget(placement, "lock", config) + row.rawLock,
      spin: fallbackModeTarget(placement, "spin", config) + row.rawSpin,
      vr: fallbackModeTarget(placement, "vr", config) + row.rawVr,
    };
    const newRhp = overallRhpFromModes(totals, placement, config);
    result.push({ userId: row.userId, username: row.username, globalRank: row.globalRank, rhythmPoints: row.rhythmPoints, oldRhp: row.oldRhp, newRhp, rpl: totals.lock, rps: totals.spin, rpv: totals.vr, battleSeed: battleSeedForRhp(newRhp) });
  }
  return result;
}

export async function applyRankingReset(actorId: string, configInput?: RankingConfig) {
  const config = configInput ?? await loadRankingConfig();
  const sources = await placementSources();
  const preview = await previewRankingReset(config);
  const previewByUser = new Map(preview.map(row => [row.userId, row]));
  const seasonRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>('SELECT id FROM "RbpSeason" WHERE "startsAt"<=CURRENT_TIMESTAMP AND "endsAt">CURRENT_TIMESTAMP ORDER BY "seasonNumber" DESC LIMIT 1');
  const seasonId = seasonRows[0]?.id ?? null;
  const resetIdRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>('SELECT gen_random_uuid()::text AS id');
  const resetId = resetIdRows[0].id;
  await prisma.$transaction(async tx => {
    for (const source of sources) {
      const row = previewByUser.get(source.userId)!;
      const placement = initialOverallPlacement({ globalRank: source.globalRank, rhythmPoints: source.rhythmPoints }, config);
      const rplBase = fallbackModeTarget(placement, "lock", config);
      const rpsBase = fallbackModeTarget(placement, "spin", config);
      const rpvBase = fallbackModeTarget(placement, "vr", config);
      const oldOverrides = await tx.$queryRawUnsafe<Array<{ system: string; points: number }>>('SELECT system,points FROM "UserPointOverride" WHERE "userId"=$1 AND system IN (\'rhp\',\'rpl\',\'rps\',\'rpv\')', source.userId);
      const oldMap = new Map(oldOverrides.map(item => [item.system, Number(item.points)]));
      let oldRbp: number | null = null;
      if (seasonId) {
        const rbpRows = await tx.$queryRawUnsafe<Array<{ rbp: number }>>('SELECT rbp FROM "RbpUserSeason" WHERE "seasonId"=$1 AND "userId"=$2 LIMIT 1', seasonId, source.userId);
        oldRbp = rbpRows[0]?.rbp ?? null;
      }
      await tx.$executeRawUnsafe('DELETE FROM "UserPointOverride" WHERE "userId"=$1 AND system IN (\'rhp\',\'rpl\',\'rps\',\'rpv\')', source.userId);
      await tx.$executeRawUnsafe('INSERT INTO "RankingBaseline" ("userId","overallFloor","rplBase","rpsBase","rpvBase",source,"lastResetId","updatedAt") VALUES ($1,$2,$3,$4,$5,\'placement-v2\',$6::uuid,CURRENT_TIMESTAMP) ON CONFLICT ("userId") DO UPDATE SET "overallFloor"=EXCLUDED."overallFloor","rplBase"=EXCLUDED."rplBase","rpsBase"=EXCLUDED."rpsBase","rpvBase"=EXCLUDED."rpvBase",source=EXCLUDED.source,"lastResetId"=EXCLUDED."lastResetId","updatedAt"=CURRENT_TIMESTAMP', source.userId, placement, rplBase, rpsBase, rpvBase, resetId);
      await tx.$executeRawUnsafe('UPDATE "User" SET rhp=$2 WHERE id=$1', source.userId, row.newRhp);
      if (seasonId) await tx.$executeRawUnsafe('INSERT INTO "RbpUserSeason" (id,"seasonId","userId","placementRankIndex",rbp,"createdAt","updatedAt") VALUES (gen_random_uuid(),$1,$2,$3,$4,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT ("seasonId","userId") DO UPDATE SET "placementRankIndex"=EXCLUDED."placementRankIndex",rbp=EXCLUDED.rbp,"updatedAt"=CURRENT_TIMESTAMP', seasonId, source.userId, getRankInfo(row.battleSeed).index, row.battleSeed);
      await tx.$executeRawUnsafe('INSERT INTO "RankingResetAudit" ("resetId","userId","oldRhp","newRhp","oldRpl","newRpl","oldRps","newRps","oldRpv","newRpv","oldRbp","newRbp","rhythiaGlobalRank","rhythiaRp",metadata) VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb)', resetId, source.userId, source.oldRhp, row.newRhp, oldMap.get("rpl") ?? source.rawLock, row.rpl, oldMap.get("rps") ?? source.rawSpin, row.rps, oldMap.get("rpv") ?? source.rawVr, row.rpv, oldRbp, seasonId ? row.battleSeed : null, source.globalRank, source.rhythmPoints, JSON.stringify({ placement, rplBase, rpsBase, rpvBase, configVersion: 2 }));
    }
    await tx.moderationAction.create({ data: { actorId, action: "ranking_system_v2_reset", targetType: "ranking", targetId: resetId, metadata: { users: sources.length, config } } });
  });
  return { resetId, users: preview.length, preview };
}
