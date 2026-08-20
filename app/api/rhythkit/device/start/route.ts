import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/security";
import { hashToken, randomToken, randomUserCode } from "@/lib/rhythkit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rate = checkRateLimit(request, "rhythkit_device_start", 10, 15 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const body = (await request.json().catch(() => null)) as { gameVersion?: unknown } | null;
  const deviceCode = randomToken("rk_device_");
  const userCode = randomUserCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await prisma.$executeRawUnsafe(`INSERT INTO "RhythKitDevice" ("id", "deviceCodeHash", "userCode", "expiresAt") VALUES (gen_random_uuid(), $1, $2, $3)`, hashToken(deviceCode), userCode, expiresAt);
  const origin = new URL(request.url).origin;
  return NextResponse.json({ deviceCode, userCode, verificationUrl: `${origin}/rhythkit/authorize?code=${encodeURIComponent(userCode)}`, expiresIn: 600, gameVersion: typeof body?.gameVersion === "string" ? body.gameVersion : null });
}
