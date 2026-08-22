import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { checkRateLimit, rateLimit } from "@/lib/security";
import { createSecurityCode, hashSecurityCode, normalizeEmail, validEmail } from "@/lib/email-auth";
import { sendSecurityCode } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const ipRate = checkRateLimit(request, "email_verification", 3, 15 * 60 * 1000);
  if (!ipRate.allowed) return NextResponse.json({ error: "Too many verification emails. Please try again later." }, { status: 429, headers: { "Retry-After": String(ipRate.retryAfterSec) } });

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (user.discordId) return NextResponse.json({ error: "Discord accounts do not need email 2FA." }, { status: 400 });

  const userRate = rateLimit(`email_verification_user:${user.id}`, 3, 15 * 60 * 1000);
  if (!userRate.allowed) return NextResponse.json({ error: "Too many verification emails. Please try again later." }, { status: 429, headers: { "Retry-After": String(userRate.retryAfterSec) } });

  const body = await request.json().catch(() => null) as { email?: unknown; password?: unknown } | null;
  const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!validEmail(email) || !password) return NextResponse.json({ error: "Enter a valid email address and your current password." }, { status: 400 });
  if (!user.passwordHash || !(await verifyPassword(password, user.passwordHash))) return NextResponse.json({ error: "The current password is incorrect." }, { status: 401 });
  if (user.emailVerifiedAt && user.emailTwoFactorEnabled) return NextResponse.json({ error: "Email 2FA is already enabled." }, { status: 400 });

  const existing = await prisma.user.findFirst({ where: { email, NOT: { id: user.id } }, select: { id: true } });
  if (existing) return NextResponse.json({ error: "That email address is already associated with another account." }, { status: 409 });

  const code = createSecurityCode();
  const verification = await prisma.emailVerification.create({
    data: {
      userId: user.id,
      email,
      codeHash: hashSecurityCode(code),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  try {
    await sendSecurityCode(email, code, "Verify your Rhythians email", "Verify your Rhythians email");
  } catch {
    await prisma.emailVerification.delete({ where: { id: verification.id } }).catch(() => undefined);
    return NextResponse.json({ error: "Email delivery is not configured or failed. Please try again later." }, { status: 503 });
  }

  return NextResponse.json({ sent: true });
}
