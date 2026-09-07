import { prisma } from "@/lib/db";
import { fetchRhythiaProfile, rhythiaRequest } from "@/lib/rhythia";
import { pointsForModeScore, scoreCameraMode, setUserPointOverride, type ModeKey } from "@/lib/rhythia-mode-points";

type Score = {
  id: number;
  beatmapTitle?: string | null;
  beatmapId?: number | null;
  mapId?: number | null;
  passed?: boolean | null;
  misses?: number | null;
  beatmapNotes?: number | null;
  accuracy?: number | null;
  awarded_sp?: number | null;
  created_at?: string | null;
  cameraMode?: string | null;
  gameMode?: string | null;
  mode?: string | null;
  spin?: boolean | null;
  vr?: boolean | null;
  isVr?: boolean | null;
  mods?: string | null;
};

type Bucket = "lastDay" | "top" | "vrTop" | "vrRecent";
type ScoreResponse = Partial<Record<Bucket, Score[]>>;

function normalize(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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

  const scoreIds = new Map<number, { score: Score; mode: ModeKey; confidence: number }>();
  const buckets: Bucket[] = ["lastDay", "top", "vrTop", "vrRecent"];
  for (const bucket of buckets) {
    for (const score of scoreData[bucket] ?? []) {
      if (!score || typeof score.id !== "number" || score.passed !== true) continue;
      const mode = scoreCameraMode(score, bucket);
      const confidence = bucket.startsWith("vr") ? 3 : mode === "spin" ? 2 : 1;
      const existing = scoreIds.get(score.id);
      if (!existing || confidence > existing.confidence) scoreIds.set(score.id, { score, mode, confidence });
    }
  }

  const best = new Map<string, { score: Score; mode: ModeKey; map: (typeof maps)[number]; points: number }>();
  for (const { score, mode } of scoreIds.values()) {
    const beatmapId = score.beatmapId ?? score.mapId ?? null;
    const map = beatmapId != null ? byBeatmapId.get(beatmapId) ?? byTitle.get(normalize(score.beatmapTitle)) : byTitle.get(normalize(score.beatmapTitle));
    if (!map) continue;
    const points = pointsForModeScore(score, mode);
    if (points <= 0) continue;
    const mapKey = map.sourceBeatmapId != null ? `rhythia:${map.sourceBeatmapId}` : `map:${map.id}`;
    const key = `${mapKey}:${mode}`;
    const candidate = { score, mode, map, points };
    const old = best.get(key);
    if (!old || points > old.points || (points === old.points && (score.awarded_sp ?? 0) > (old.score.awarded_sp ?? 0)) || (points === old.points && (score.awarded_sp ?? 0) === (old.score.awarded_sp ?? 0) && String(score.created_at ?? "") > String(old.score.created_at ?? ""))) best.set(key, candidate);
  }

  const rows = [...best.values()].map(({ score, mode, map, points }) => ({
    userId,
    mapKey: map.sourceBeatmapId != null ? `rhythia:${map.sourceBeatmapId}` : `map:${map.id}`,
    mapTitle: map.title,
    scoreId: score.id,
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
    if (rows.length) await tx.rhythiaModeScore.createMany({ data: rows });
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
    passedScores: scoreIds.size,
    uniqueScoredMaps: rows.length,
    modes: {
      lock: rows.filter((row) => row.cameraMode === "lock").length,
      spin: rows.filter((row) => row.cameraMode === "spin").length,
      vr: rows.filter((row) => row.cameraMode === "vr").length,
    },
  };
}
