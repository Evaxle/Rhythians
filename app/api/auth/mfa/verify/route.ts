import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, setSessionCookie } from "@/lib/auth";
import { hashSecurityCode, MFA_COOKIE_NAME } from "@/lib/email-auth";
import { checkRateLimit } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rate = checkRateLimit(request, "auth_mfa_verify", 10, 15 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many verification attempts. Please try again later." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } });

  const cookieStore = await cookies();
  const challengeId = cookieStore.get(MFA_COOKIE_NAME)?.value;
  if (!challengeId) return NextResponse.json({ error: "Your sign-in challenge has expired. Please sign in again." }, { status: 401 });

  const body = await request.json().catch(() => null) as { code?: unknown } | null;
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: "Enter the six-digit code from your email." }, { status: 400 });

  const challenge = await prisma.emailMfaChallenge.findUnique({ where: { id: challengeId }, include: { user: true } });
  if (!challenge || challenge.usedAt || challenge.expiresAt <= new Date()) return NextResponse.json({ error: "Your sign-in code has expired. Please sign in again." }, { status: 401 });
  if (challenge.attempts >= 5) return NextResponse.json({ error: "Too many incorrect attempts. Please sign in again." }, { status: 429 });
  if (challenge.user.isSuspended || (challenge.user.suspendedUntil && challenge.user.suspendedUntil > new Date())) return NextResponse.json({ error: "This account is currently unavailable." }, { status: 403 });

  const expected = Buffer.from(challenge.codeHash, "hex");
  const actual = Buffer.from(hashSecurityCode(code), "hex");
  const matches = expected.length === actual.length && timingSafeEqual(expected, actual);
  if (!matches) {
    const attempts = challenge.attempts + 1;
    await prisma.emailMfaChallenge.update({ where: { id: challenge.id }, data: { attempts } });
    return NextResponse.json({ error: attempts >= 5 ? "Too many incorrect attempts. Please sign in again." : "That code is incorrect." }, { status: attempts >= 5 ? 429 : 400 });
  }

  const claimed = await prisma.emailMfaChallenge.updateMany({ where: { id: challenge.id, usedAt: null }, data: { usedAt: new Date() } });
  if (claimed.count !== 1) return NextResponse.json({ error: "That code has already been used." }, { status: 409 });

  const token = await createSession(challenge.userId);
  const response = NextResponse.json({ verified: true, redirectTo: challenge.redirectTo ?? "/" });
  setSessionCookie(response, token);
  response.cookies.set({ name: MFA_COOKIE_NAME, value: "", httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  await prisma.emailMfaChallenge.delete({ where: { id: challenge.id } }).catch(() => undefined);
  return response;
}
