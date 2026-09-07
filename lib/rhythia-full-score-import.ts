import { prisma } from "@/lib/db";
import { fetchRhythiaProfile, rhythiaRequest } from "@/lib/rhythia";
import { pointsForModeScore, scoreCameraMode, setUserPointOverride, type ModeKey } from "@/lib/rhythia-mode-points";

type Score = {
  id?: number | string | null;
  beatmapTitle?: string | null;
  beatmap_title?: string | null;
  title?: string | null;
  beatmapId?: number | string | null;
  beatmap_id?: number | string | null;
  mapId?: number | string | null;
  map_id?: number | string | null;
  passed?: boolean | number | string | null;
  misses?: number | null;
  beatmapNotes?: number | null;
  beatmap_notes?: number | null;
  accuracy?: number | null;
  awarded_sp?: number | null;
  awardedSp?: number | null;
  created_at?: string | null;
  createdAt?: string | null;
  cameraMode?: string | null;
  camera_mode?: string | null;
  gameMode?: string | null;
  game_mode?: string | null;
  mode?: string | null;
  playMode?: string | null;
  play_mode?: string | null;
  spin?: boolean | number | string | null;
  vr?: boolean | number | string | null;
  isVr?: boolean | null;
  is_vr?: boolean | null;
  mods?: string | string[] | null;
  modifiers?: string | string[] | null;
};

type Bucket = "lastDay" | "top" | "vrTop" | "vrRecent" | "recent" | "scores" | "passed";
type ScoreResponse = Partial<Record<Bucket, Score[]>> & { data?: Score[] | { scores?: Score[] }; items?: Score[]; results?: Score[] };

function normalize(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function numberValue(value: unknown) {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}

function scoreId(score: Score) {
  return numberValue(score.id);
}

function mapId(score: Score) {
  return numberValue(score.beatmapId ?? score.beatmap_id ?? score.mapId ?? score.map_id);
}

function mapTitle(score: Score) {
  return score.beatmapTitle ?? score.beatmap_title ?? score.title ?? null;
}

function isPassed(score: Score) {
  const value = score.passed;
  if (value === false || value === 0) return false;
  if (typeof value === "string" && ["false", "0", "failed", "fail", "no"].includes(value.trim().toLowerCase())) return false;
  if (value === true || value === 1) return true;
  if (typeof value === "string" && ["true", "1", "passed", "pass", "yes"].includes(value.trim().toLowerCase())) return true;
  return typeof score.accuracy === "number" && score.accuracy > 0;
}

function normalizeScore(score: Score) {
  return {
    ...score,
    id: scoreId(score) ?? undefined,
    beatmapTitle: mapTitle(score),
    beatmapId: mapId(score),
    beatmapNotes: score.beatmapNotes ?? score.beatmap_notes ?? null,
    awarded_sp: score.awarded_sp ?? score.awardedSp ?? null,
    created_at: score.created_at ?? score.createdAt ?? null,
  };
}

function scoreArrays(data: ScoreResponse) {
  const entries: Array<{ bucket: string; scores: Score[] }> = [];
  for (const bucket of ["lastDay", "top", "vrTop", "vrRecent", "recent", "scores", "passed"] as const) {
    if (Array.isArray(data[bucket])) entries.push({ bucket, scores: data[bucket] ?? [] });
  }
  if (Array.isArray(data.items)) entries.push({ bucket: "items", scores: data.items });
  if (Array.isArray(data.results)) entries.push({ bucket: "results", scores: data.results });
  if (Array.isArray(data.data)) entries.push({ bucket: "data", scores: data.data });
  else if (data.data && typeof data.data === "object" && Array.isArray(data.data.scores)) entries.push({ bucket: "data", scores: data.data.scores });
  return entries;
}

export async function rebuildRhythiaScorePoints(userId: string) {
  const linked = await prisma.rhythiaProfile.findUnique({ where: { userId }, select: { profileId: true, profileUrl: true } });
  if (!linked) throw new Error("This player does not have a linked Rhythia profile.");

  const [profile, scoreData, maps] = await Promise.all([
    fetchRhythiaProfile(linked.profileId),
    rhythiaRequest<ScoreResponse>("getUserScores", { id: linked.profileId, limit: 10000 }),
    prisma.challengeMap.findMany({ where: { status: "approved" }, select: { id: true, title: true, sourceBeatmapId: true } }),
  ]);

  const byBeatmapId = new Map<number, (typeof maps)[number]>();
  const byTitle = new Map<string, (typeof maps)[number]>();
  for (const map of maps) {
    if (map.sourceBeatmapId != null) byBeatmapId.set(map.sourceBeatmapId, map);
    const title = normalize(map.title);
    if (title) byTitle.set(title, map);
  }

  const uniqueScores = new Map<number, { score: ReturnType<typeof normalizeScore>; mode: ModeKey; confidence: number }>();
  for (const { bucket, scores } of scoreArrays(scoreData)) {
    for (const raw of scores) {
      const id = scoreId(raw);
      if (id == null || !isPassed(raw)) continue;
      const score = normalizeScore(raw);
      const mode = scoreCameraMode(score, bucket);
      const confidence = bucket.toLowerCase().includes("vr") || mode === "vr" ? 3 : mode === "spin" ? 2 : 1;
      const existing = uniqueScores.get(id);
      if (!existing || confidence > existing.confidence) uniqueScores.set(id, { score, mode, confidence });
    }
  }

  const best = new Map<string, { score: ReturnType<typeof normalizeScore>; mode: ModeKey; map: (typeof maps)[number]; points: number }>();
  for (const { score, mode } of uniqueScores.values()) {
    const beatmapId = mapId(score);
    const title = normalize(mapTitle(score));
    const map = beatmapId != null ? byBeatmapId.get(beatmapId) ?? byTitle.get(title) : byTitle.get(title);
    if (!map) continue;
    const points = pointsForModeScore(score, mode);
    if (points <= 0) continue;
    const mapKey = map.sourceBeatmapId != null ? `rhythia:${map.sourceBeatmapId}` : `map:${map.id}`;
    const key = `${mapKey}:${mode}`;
    const candidate = { score, mode, map, points };
    const old = best.get(key);
    const awarded = score.awarded_sp ?? 0;
    const oldAwarded = old?.score.awarded_sp ?? 0;
    if (!old || points > old.points || (points === old.points && awarded > oldAwarded) || (points === old.points && awarded === oldAwarded && String(score.created_at ?? "") > String(old.score.created_at ?? ""))) best.set(key, candidate);
  }

  const rows = [...best.values()].map(({ score, mode, map, points }) => ({
    userId,
    mapKey: map.sourceBeatmapId != null ? `rhythia:${map.sourceBeatmapId}` : `map:${map.id}`,
    mapTitle: map.title,
    scoreId: Number(score.id),
    cameraMode: mode,
    points,
    accuracy: score.accuracy ?? null,
    awardedSp: score.awarded_sp ?? null,
  }));

  const totals = { lock: 0, spin: 0, vr: 0 };
  for (const row of rows) totals[row.cameraMode] += row.points;
  const rhp = totals.lock + totals.spin + totals.vr;
  const { bio: _bio, ...profileData } = profile;

  await prisma.$transaction(async (tx) => {
    await tx.rhythiaModeScore.deleteMany({ where: { userId } });
    if (rows.length) await tx.rhythiaModeScore.createMany({ data: rows, skipDuplicates: true });
    await tx.rhythiaProfile.update({ where: { userId }, data: { ...profileData, profileUrl: linked.profileUrl, syncedAt: new Date() } });
    await tx.user.update({ where: { id: userId }, data: { rhp, scoreImportDone: true, lastRhythiaRpCheckAt: new Date(), rhythiaVerified: true } });
  });

  await Promise.all([
    setUserPointOverride(userId, "rpl", null),
    setUserPointOverride(userId, "rps", null),
    setUserPointOverride(userId, "rpv", null),
    setUserPointOverride(userId, "rhp", null),
  ]);

  return {
    rpl: totals.lock,
    rps: totals.spin,
    rpv: totals.vr,
    rhp,
    passedScores: uniqueScores.size,
    uniqueScoredMaps: rows.length,
    modes: {
      lock: rows.filter((row) => row.cameraMode === "lock").length,
      spin: rows.filter((row) => row.cameraMode === "spin").length,
      vr: rows.filter((row) => row.cameraMode === "vr").length,
    },
  };
}
