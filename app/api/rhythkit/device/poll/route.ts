import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashToken, randomToken } from "@/lib/rhythkit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { deviceCode?: unknown } | null;
  const deviceCode = typeof body?.deviceCode === "string" ? body.deviceCode.trim() : "";
  if (!deviceCode) return NextResponse.json({ ok: false, error: "Device code is required." }, { status: 400 });

  const result = await prisma.$transaction(async (tx) => {
    const devices = await tx.$queryRawUnsafe<Array<{ id: string; userId: string | null; status: string; expiresAt: Date }>>(
      `SELECT "id", "userId", "status", "expiresAt" FROM "RhythKitDevice" WHERE "deviceCodeHash" = $1 LIMIT 1 FOR UPDATE`,
      hashToken(deviceCode)
    );
    const device = devices[0];
    if (!device) return { response: NextResponse.json({ ok: false, error: "Invalid device code." }, { status: 404 }) };
    if (device.expiresAt <= new Date()) {
      if (device.status === "pending") await tx.$executeRawUnsafe(`UPDATE "RhythKitDevice" SET "status" = 'revoked' WHERE "id" = $1`, device.id);
      return { response: NextResponse.json({ ok: false, error: "Device authorization expired." }, { status: 410 }) };
    }
    if (device.status === "pending") return { response: NextResponse.json({ ok: true, pending: true }) };
    if (device.status !== "authorized" || !device.userId) return { response: NextResponse.json({ ok: false, error: "access_denied" }, { status: 403 }) };

    const users = await tx.$queryRawUnsafe<Array<{ username: string }>>(`SELECT "username" FROM "User" WHERE "id" = $1 LIMIT 1`, device.userId);
    const user = users[0];
    if (!user) return { response: NextResponse.json({ ok: false, error: "User not found." }, { status: 404 }) };

    const installations = await tx.$queryRawUnsafe<Array<{ installationId: string }>>(
      `SELECT "installationId" FROM "RhythKitInstallation" WHERE "userId" = $1 AND "revokedAt" IS NULL ORDER BY "createdAt" DESC LIMIT 1`,
      device.userId
    );
    const installationId = installations[0]?.installationId ?? crypto.randomUUID();
    const token = randomToken("rk_");
    const tokenHash = hashToken(token);

    if (installations[0]) {
      await tx.$executeRawUnsafe(
        `UPDATE "RhythKitInstallation" SET "tokenHash" = $1, "lastSeenAt" = NOW(), "revokedAt" = NULL WHERE "installationId" = $2`,
        tokenHash,
        installationId
      );
    } else {
      await tx.$executeRawUnsafe(
        `INSERT INTO "RhythKitInstallation" ("id", "userId", "installationId", "tokenHash") VALUES ($1, $2, $3, $4)`,
        crypto.randomUUID(),
        device.userId,
        installationId,
        tokenHash
      );
    }

    await tx.$executeRawUnsafe(`UPDATE "RhythKitDevice" SET "status" = 'revoked' WHERE "id" = $1`, device.id);
    return {
      response: NextResponse.json({
        ok: true,
        authorized: true,
        token,
        installationId,
        userId: device.userId,
        username: user.username,
      }),
    };
  });

  return result.response;
}
