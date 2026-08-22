import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/rhythkit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return NextResponse.json({ ok: false, authenticated: false }, { status: 401 });

  const rows = await prisma.$queryRawUnsafe<Array<{ installationId: string; userId: string; revokedAt: Date | null; lastSeenAt: Date | null; username: string | null }>>(
    `SELECT r."installationId", r."userId", r."revokedAt", r."lastSeenAt", u."username" FROM "RhythKitInstallation" r INNER JOIN "User" u ON u."id" = r."userId" WHERE r."tokenHash" = $1 LIMIT 1`,
    hashToken(token)
  );
  const installation = rows[0];
  if (!installation || installation.revokedAt || !installation.username) return NextResponse.json({ ok: false, authenticated: false }, { status: 401 });

  await prisma.$executeRawUnsafe(`UPDATE "RhythKitInstallation" SET "lastSeenAt" = NOW() WHERE "installationId" = $1`, installation.installationId);
  return NextResponse.json({ ok: true, authenticated: true, userId: installation.userId, username: installation.username });
}
