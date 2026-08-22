import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/security";
import { createSecurityCode, hashSecurityCode, MFA_COOKIE_NAME } from "@/lib/email-auth";
import { sendSecurityCode } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rate = checkRateLimit(request, "auth_mfa_resend", 3, 15 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many code requests. Please wait before requesting another code." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } });

  const cookieStore = await cookies();
  const challengeId = cookieStore.get(MFA_COOKIE_NAME)?.value;
  if (!challengeId) return NextResponse.json({ error: "Your sign-in challenge has expired. Please sign in again." }, { status: 401 });

  const challenge = await prisma.emailMfaChallenge.findUnique({ where: { id: challengeId }, include: { user: true } });
  if (!challenge || challenge.usedAt || challenge.expiresAt <= new Date() || !challenge.user.email || !challenge.user.emailVerifiedAt || !challenge.user.emailTwoFactorEnabled) return NextResponse.json({ error: "Your sign-in challenge has expired. Please sign in again." }, { status: 401 });

  const code = createSecurityCode();
  await prisma.emailMfaChallenge.update({ where: { id: challenge.id }, data: { codeHash: hashSecurityCode(code), expiresAt: new Date(Date.now() + 10 * 60 * 1000), attempts: 0 } });
  try {
    await sendSecurityCode(challenge.user.email, code, "Your new Rhythians sign-in code", "Your new Rhythians sign-in code");
  } catch {
    return NextResponse.json({ error: "We could not send a new code. Please try again later." }, { status: 503 });
  }
  return NextResponse.json({ sent: true });
}
