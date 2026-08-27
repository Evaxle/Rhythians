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
  return `${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).slice(0, 3).join("")}-${Array.from(bytes.slice(3), (byte) => alphabet[byte % alphabet.length]).slice(0, 3).join("")}`;
}

export function getRankIndex(rhp: number) {
  return Math.min(8, Math.floor(Math.max(0, Math.floor(rhp)) / 500));
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
