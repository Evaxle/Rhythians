import crypto from "node:crypto";
import { getRankInfo, RANKS } from "@/lib/ranks";

export function randomToken(prefix: string) {
  return `${prefix}${crypto.randomBytes(32).toString("hex")}`;
}

export function hashToken(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function randomUserCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(8);
  return `${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).slice(0, 3).join("")}-${Array.from(bytes.slice(3), (byte) => alphabet[byte % alphabet.length]).slice(0, 3).join("")}`;
}

export function getRankIndex(rhp: number) {
  return getRankInfo(rhp).index;
}

export function getRankRange(index: number) {
  const rank = RANKS[Math.max(0, Math.min(RANKS.length - 1, Math.floor(index)))] ?? RANKS[RANKS.length - 1];
  return [rank.rangeMin, rank.rangeMax];
}
