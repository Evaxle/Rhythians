import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getSessionUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canAccessAdmin(admin))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { level?: unknown } | null;
  const level = body?.level == null || body.level === "" ? null : Number(body.level);

  if (level !== null && (!Number.isInteger(level) || level < 1 || level > 20)) {
    return NextResponse.json({ error: "Challenge level must be between 1 and 20." }, { status: 400 });
  }

  const map = await prisma.challengeMap.findUnique({ where: { id }, select: { id: true, title: true, status: true } });
  if (!map) return NextResponse.json({ error: "Challenge map not found." }, { status: 404 });
  if (level !== null && map.status !== "approved") return NextResponse.json({ error: "Only approved Challenge maps can be assigned to levels." }, { status: 400 });

  if (level === null) {
    await prisma.$executeRawUnsafe('DELETE FROM "ChallengeMapLevel" WHERE "challengeMapId" = $1', id);
  } else {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ChallengeMapLevel" ("id", "challengeMapId", "level", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT ("challengeMapId") DO UPDATE SET "level" = EXCLUDED."level", "updatedAt" = CURRENT_TIMESTAMP`,
      randomUUID(),
      id,
      level,
    );
  }

  return NextResponse.json({ map, level });
}
