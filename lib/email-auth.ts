import { createHash, randomInt } from "node:crypto";

export const MFA_COOKIE_NAME = "__Host-rhythians-mfa";

export function createSecurityCode() {
  return randomInt(0, 1000000).toString().padStart(6, "0");
}

export function hashSecurityCode(code: string) {
  const secret = process.env.AUTH_SECRET ?? (process.env.NODE_ENV === "production" ? "" : "development-only-rhythians-secret");
  if (!secret) throw new Error("AUTH_SECRET is required in production.");
  return createHash("sha256").update(`${secret}:${code}`).digest("hex");
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function validEmail(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
