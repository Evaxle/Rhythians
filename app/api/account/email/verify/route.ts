import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { hashSecurityCode, normalizeEmail } from "@/lib/email-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (user.discordId) return NextResponse.json({ error: "Discord accounts do not need email 2FA." }, { status: 400 });

  const body = await request.json().catch(() => null) as { code?: unknown } | null;
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: "Enter the six-digit code from your email." }, { status: 400 });

  const verification = await prisma.emailVerification.findFirst({ where: { userId: user.id, usedAt: null }, orderBy: { createdAt: "desc" } });
  if (!verification || verification.expiresAt <= new Date()) return NextResponse.json({ error: "That verification code has expired. Request a new one." }, { status: 400 });
  if (verification.attempts >= 5) return NextResponse.json({ error: "Too many incorrect attempts. Request a new code." }, { status: 429 });

  const expected = Buffer.from(verification.codeHash, "hex");
  const actual = Buffer.from(hashSecurityCode(code), "hex");
  const matches = expected.length === actual.length && timingSafeEqual(expected, actual);
  if (!matches) {
    const attempts = verification.attempts + 1;
    await prisma.emailVerification.update({ where: { id: verification.id }, data: { attempts } });
    return NextResponse.json({ error: attempts >= 5 ? "Too many incorrect attempts. Request a new code." : "That code is incorrect." }, { status: attempts >= 5 ? 429 : 400 });
  }

  const email = normalizeEmail(verification.email);
  const claimed = await prisma.emailVerification.updateMany({ where: { id: verification.id, usedAt: null }, data: { usedAt: new Date() } });
  if (claimed.count !== 1) return NextResponse.json({ error: "That code has already been used." }, { status: 409 });

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { email, emailVerifiedAt: new Date(), emailTwoFactorEnabled: true } }),
    prisma.emailVerification.deleteMany({ where: { userId: user.id, id: { not: verification.id } } }),
  ]);

  return NextResponse.json({ verified: true, email, twoFactorEnabled: true });
}
