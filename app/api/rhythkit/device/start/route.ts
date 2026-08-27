import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/security";
import { hashToken, randomToken, randomUserCode } from "@/lib/rhythkit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rate = checkRateLimit(request, "rhythkit_device_start", 10, 15 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429 });
  const deviceCode = randomToken("DEV_");
  const userCode = randomUserCode();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await prisma.$executeRawUnsafe(
    `INSERT INTO "RhythKitDevice" ("id", "deviceCodeHash", "userCode", "expiresAt") VALUES ($1, $2, $3, $4)`,
    crypto.randomUUID(),
    hashToken(deviceCode),
    userCode,
    expiresAt
  );
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://rhythians.vercel.app").replace(/\/$/, "");
  return NextResponse.json({
    ok: true,
    deviceCode,
    userCode,
    verificationUrl: `${baseUrl}/rhythkit/authorize?code=${encodeURIComponent(userCode)}`,
    expiresIn: 300,
  });
}
