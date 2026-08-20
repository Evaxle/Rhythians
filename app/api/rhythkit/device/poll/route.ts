import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashToken, randomToken } from "@/lib/rhythkit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { deviceCode?: unknown } | null;
  const deviceCode = typeof body?.deviceCode === "string" ? body.deviceCode : "";
  if (!deviceCode) return NextResponse.json({ error: "Device code is required." }, { status: 400 });

  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; userId: string | null; status: string; expiresAt: Date }>>(`SELECT "id", "userId", "status", "expiresAt" FROM "RhythKitDevice" WHERE "deviceCodeHash" = $1 LIMIT 1`, hashToken(deviceCode));
  const device = rows[0];
  if (!device) return NextResponse.json({ status: "invalid" }, { status: 404 });
  if (device.expiresAt < new Date()) return NextResponse.json({ status: "expired" }, { status: 410 });
  if (device.status === "pending") return NextResponse.json({ status: "pending" });
  if (device.status !== "authorized" || !device.userId) return NextResponse.json({ status: "revoked" }, { status: 403 });

  const token = randomToken("rk_");
  const installationId = crypto.randomUUID();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`INSERT INTO "RhythKitInstallation" ("id", "userId", "installationId", "tokenHash") VALUES ($1, $2, $3, $4)`, crypto.randomUUID(), device.userId, installationId, hashToken(token));
    await tx.$executeRawUnsafe(`UPDATE "RhythKitDevice" SET "status" = 'revoked' WHERE "id" = $1`, device.id);
  });

  return NextResponse.json({ status: "authorized", token, installationId });
}
