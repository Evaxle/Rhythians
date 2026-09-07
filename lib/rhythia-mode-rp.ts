import { rhythiaRequest, type RhythiaScore } from "@/lib/rhythia";

export type RhythiaModeRp = { lock: number; spin: number; vr: number };

type ScoreRecord = RhythiaScore & Record<string, unknown>;

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value)) && Number(value) >= 0) return Number(value);
  return null;
}

function field(record: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    const value = numberValue(record[name]);
    if (value != null) return value;
  }
  return null;
}

function directModeRp(value: unknown): RhythiaModeRp | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const lock = field(record, ["lock_rp", "lockRp", "lockRP", "lock_skill_points", "lockSkillPoints", "skill_points_lock", "skillPointsLock", "rp_lock", "rpLock"]);
  const spin = field(record, ["spin_rp", "spinRp", "spinRP", "spin_skill_points", "spinSkillPoints", "skill_points_spin", "skillPointsSpin", "rp_spin", "rpSpin"]);
  const vr = field(record, ["vr_rp", "vrRp", "vrRP", "vr_skill_points", "vrSkillPoints", "skill_points_vr", "skillPointsVr", "rp_vr", "rpVr"]);
  if (lock != null || spin != null || vr != null) return { lock: lock ?? 0, spin: spin ?? 0, vr: vr ?? 0 };
  for (const nested of Object.values(record)) {
    const result = directModeRp(nested);
    if (result) return result;
  }
  return null;
}

function enabled(value: unknown) {
  if (value === true || value === 1) return true;
  if (typeof value !== "string") return false;
  return ["1", "true", "yes", "on", "enabled", "spin"].includes(value.trim().toLowerCase());
}

function text(value: unknown) {
  if (Array.isArray(value)) return value.map(String).join(" ");
  if (value && typeof value === "object") return Object.entries(value as Record<string, unknown>).map(([key, item]) => `${key} ${String(item)}`).join(" ");
  return typeof value === "string" ? value : "";
}

function scoreMode(score: ScoreRecord, bucket: string): keyof RhythiaModeRp {
  const explicit = [score.cameraMode, score.camera_mode, score.gameMode, score.game_mode, score.mode, score.playMode, score.play_mode, score["camera"], score["camera_mode_name"], score["play_mode_name"]].map(text).join(" ").toLowerCase();
  const modifiers = [score.mods, score.modifiers, score["modifiers_json"], score["settings"]].map(text).join(" ").toLowerCase();
  const bucketName = bucket.toLowerCase();
  if (explicit.includes("vr") || explicit.includes("virtual reality") || enabled(score.vr) || enabled(score.isVr) || enabled(score.is_vr) || bucketName.includes("vr") || /(^|[^a-z])vr([^a-z]|$)/i.test(modifiers)) return "vr";
  if (explicit.includes("spin") || enabled(score.spin) || enabled(score["isSpin"]) || enabled(score["is_spin"]) || enabled(score["spinMode"]) || enabled(score["spin_mode"]) || bucketName.includes("spin") || /(^|[^a-z])spin([^a-z]|$)/i.test(modifiers)) return "spin";
  return "lock";
}

function scoreArrays(value: unknown, path = "root", result: Array<{ bucket: string; scores: ScoreRecord[] }> = []) {
  if (!value || typeof value !== "object") return result;
  if (Array.isArray(value)) {
    const scores = value.filter((item): item is ScoreRecord => Boolean(item) && typeof item === "object" && typeof (item as Record<string, unknown>).id === "number");
    if (scores.length) result.push({ bucket: path, scores });
    return result;
  }
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) scoreArrays(nested, `${path}.${key}`, result);
  return result;
}

function rpFromScores(data: unknown): RhythiaModeRp {
  const best = new Map<number, { score: ScoreRecord; mode: keyof RhythiaModeRp; confidence: number }>();
  for (const bucket of scoreArrays(data)) {
    for (const score of bucket.scores) {
      const mode = scoreMode(score, bucket.bucket);
      const confidence = bucket.bucket.toLowerCase().includes(mode) || mode !== "lock" ? 2 : 1;
      const existing = best.get(score.id);
      if (!existing || confidence > existing.confidence) best.set(score.id, { score, mode, confidence });
    }
  }
  const awarded: RhythiaModeRp = { lock: 0, spin: 0, vr: 0 };
  for (const { score, mode } of best.values()) {
    if (score.passed === false) continue;
    const points = numberValue(score.awarded_sp ?? score["awardedSp"] ?? score["skill_points"] ?? score["skillPoints"] ?? score["rp"]);
    if (points != null && points > 0) awarded[mode] += points;
  }
  return { lock: awarded.lock / 2, spin: awarded.spin / 2, vr: awarded.vr / 2 };
}

export async function fetchReliableRhythiaModeRp(id: number): Promise<RhythiaModeRp> {
  const [profile, scores] = await Promise.all([
    rhythiaRequest<Record<string, unknown>>("getProfile", { id }),
    rhythiaRequest<Record<string, unknown>>("getUserScores", { id, limit: 250 }),
  ]);
  const direct = directModeRp(profile);
  const calculated = rpFromScores(scores);
  if (direct) {
    return {
      lock: direct.lock > 0 ? direct.lock : calculated.lock,
      spin: direct.spin > 0 ? direct.spin : calculated.spin,
      vr: direct.vr > 0 ? direct.vr : calculated.vr,
    };
  }
  if (calculated.lock > 0 || calculated.spin > 0 || calculated.vr > 0) return calculated;
  const user = profile.user && typeof profile.user === "object" ? profile.user as Record<string, unknown> : null;
  const overall = user ? field(user, ["skill_points", "skillPoints", "rp"]) : null;
  if (overall != null) return { lock: overall, spin: 0, vr: 0 };
  throw new Error("Rhythia returned no usable mode RP for this profile.");
}
