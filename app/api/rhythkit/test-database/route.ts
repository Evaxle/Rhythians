import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/rhythkit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return NextResponse.json({ error: "Authorization required." }, { status: 401 });
  const installations = await prisma.$queryRawUnsafe<Array<{ userId: string }>>(`SELECT "userId" FROM "RhythKitInstallation" WHERE "tokenHash" = $1 AND "revokedAt" IS NULL LIMIT 1`, hashToken(token));
  const installation = installations[0];
  if (!installation) return NextResponse.json({ error: "Invalid Rhythians installation." }, { status: 401 });
  const admins = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT ur."userId" AS id FROM "UserRole" ur JOIN "Role" r ON r.id = ur."roleId" WHERE ur."userId" = $1 AND LOWER(r.name) = 'admin' LIMIT 1`, installation.userId);
  if (!admins[0]) return NextResponse.json({ error: "This temporary database test is restricted to administrators." }, { status: 403 });
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; created_at: Date }>>(`INSERT INTO public.rhythkit_connection_tests (user_id, source) VALUES ($1, 'RhythKit Agent') RETURNING id, created_at`, installation.userId);
  return NextResponse.json({ ok: true, testId: rows[0]?.id ?? null, createdAt: rows[0]?.created_at ?? null });
}
