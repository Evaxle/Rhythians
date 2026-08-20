import crypto from "node:crypto";

export function randomToken(prefix: string) {
  return `${prefix}${crypto.randomBytes(32).toString("hex")}`;
}

export function hashToken(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function randomUserCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(8);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export function getRankIndex(rhp: number) {
  return Math.min(8, Math.floor(Math.max(0, rhp) / 500));
}

export function getRankRange(index: number) {
  const ranges = [
    [0, 1.09],
    [1.1, 1.49],
    [1.5, 1.89],
    [1.9, 2.29],
    [2.3, 2.69],
    [2.7, 2.99],
    [3, 3.29],
    [3.3, 3.69],
    [3.7, 9.99],
  ];
  return ranges[index] ?? ranges[8];
}

export function calculateRhp(rating: number, accuracy: number | null, speed: number | null, rankIndex: number, lengthMs: number | null) {
  const [min, max] = getRankRange(rankIndex);
  const safe = Math.max(min, Math.min(max, rating));
  const factor = Math.min(1, Math.max(0, (safe - min) / Math.max(0.01, max - min)));
  const base = 18 + (25 - 18) * factor;
  const seconds = lengthMs && lengthMs > 0 ? lengthMs / 1000 : null;
  const lengthMultiplier = seconds == null ? 1 : Math.min(1.35, Math.max(0.7, 0.75 + 0.25 * Math.sqrt(seconds / 180)));
  const accuracyMultiplier = accuracy == null ? 1 : accuracy >= 100 ? 1 : accuracy >= 99 ? 0.9 : accuracy >= 98 ? 0.75 : accuracy >= 95 ? 0.6 : accuracy >= 90 ? 0.5 : 0.4;
  const speedMultiplier = speed == null || speed <= 1.001 ? 1 : Math.min(1.5, 1 + (speed - 1) * 0.25);
  return Math.max(5, Math.round(base * lengthMultiplier * accuracyMultiplier * speedMultiplier));
}
