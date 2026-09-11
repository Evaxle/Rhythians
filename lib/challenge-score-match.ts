import { rhythiaRequest } from "@/lib/rhythia";

export type ChallengeScore = {
  id: number;
  beatmapTitle?: string | null;
  beatmap_title?: string | null;
  title?: string | null;
  beatmapId?: number | null;
  beatmap_id?: number | null;
  mapId?: number | null;
  map_id?: number | null;
  passed?: boolean | number | string | null;
  misses?: number | null;
  beatmapNotes?: number | null;
  beatmap_notes?: number | null;
  accuracy?: number | null;
  [key: string]: unknown;
};

function normalizeTitle(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeSourceId(value: number | null | undefined) {
  if (value == null || !Number.isSafeInteger(value)) return null;
  return value > 0x7fffffff && value <= 0xffffffff ? value - 0x100000000 : value;
}

function scoreSourceId(score: ChallengeScore) {
  const value = score.beatmapId ?? score.beatmap_id ?? score.mapId ?? score.map_id ?? null;
  return typeof value === "number" ? normalizeSourceId(value) : null;
}

function scoreTitle(score: ChallengeScore) {
  return score.beatmapTitle ?? score.beatmap_title ?? score.title ?? "";
}

function scorePassed(score: ChallengeScore) {
  if (score.passed === true || score.passed === 1) return true;
  if (score.passed === false || score.passed === 0) return false;
  if (typeof score.passed === "string") {
    const value = score.passed.trim().toLowerCase();
    if (["true", "1", "passed", "pass", "yes"].includes(value)) return true;
    if (["false", "0", "failed", "fail", "no"].includes(value)) return false;
  }
  return typeof score.accuracy === "number" && Number.isFinite(score.accuracy) && score.accuracy > 0;
}

function collectScores(value: unknown, result: ChallengeScore[] = []) {
  if (!value || typeof value !== "object") return result;
  if (Array.isArray(value)) {
    for (const item of value) {
      if (item && typeof item === "object" && typeof (item as Record<string, unknown>).id === "number") result.push(item as ChallengeScore);
      else collectScores(item, result);
    }
    return result;
  }
  for (const nested of Object.values(value as Record<string, unknown>)) collectScores(nested, result);
  return result;
}

export async function fetchChallengeScores(profileId: number) {
  const payload = await rhythiaRequest<unknown>("getUserScores", { id: profileId, limit: 1000 });
  const seen = new Map<number, ChallengeScore>();
  for (const score of collectScores(payload)) if (!seen.has(score.id)) seen.set(score.id, score);
  return [...seen.values()];
}

export function findChallengeScore(scores: ChallengeScore[], title: string, sourceBeatmapId?: number | null) {
  const wantedId = normalizeSourceId(sourceBeatmapId);
  if (wantedId != null) {
    const byId = scores.find((score) => scorePassed(score) && scoreSourceId(score) === wantedId);
    if (byId) return byId;
  }
  const wantedTitle = normalizeTitle(title);
  if (!wantedTitle) return null;
  return scores.find((score) => scorePassed(score) && normalizeTitle(scoreTitle(score)) === wantedTitle) ?? null;
}

export function challengeScoreAccuracy(score: ChallengeScore) {
  if (typeof score.accuracy === "number" && Number.isFinite(score.accuracy)) return score.accuracy;
  const notes = score.beatmapNotes ?? score.beatmap_notes ?? null;
  if (typeof notes === "number" && notes > 0 && typeof score.misses === "number" && Number.isFinite(score.misses)) return Math.max(0, Math.min(100, ((notes - score.misses) / notes) * 100));
  return null;
}
