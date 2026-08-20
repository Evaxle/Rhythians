import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashToken, calculateRhp, getRankIndex, getRankRange } from "@/lib/rhythkit";

export const runtime = "nodejs";

type Installation = { userId: string; installationId: string; revokedAt: Date | null };
type MapRow = { id: string; title: string; rating: number | null; length: number | null; status: string; isAutoImported: boolean; rhpOverride: number | null };

export async function POST(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return NextResponse.json({ error: "Authorization required." }, { status: 401 });

  const installations = await prisma.$queryRawUnsafe<Installation[]>(`SELECT "userId", "installationId", "revokedAt" FROM "RhythKitInstallation" WHERE "tokenHash" = $1 LIMIT 1`, hashToken(token));
  const installation = installations[0];
  if (!installation || installation.revokedAt) return NextResponse.json({ error: "Invalid RhythKit installation." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { challengeMapId?: unknown; clientScoreId?: unknown; accuracy?: unknown; misses?: unknown; speed?: unknown } | null;
  const challengeMapId = typeof body?.challengeMapId === "string" ? body.challengeMapId : "";
  const clientScoreId = typeof body?.clientScoreId === "string" ? body.clientScoreId : "";
  const accuracy = typeof body?.accuracy === "number" && Number.isFinite(body.accuracy) ? Math.max(0, Math.min(100, body.accuracy)) : null;
  const misses = typeof body?.misses === "number" && Number.isInteger(body.misses) && body.misses >= 0 ? body.misses : null;
  const speed = typeof body?.speed === "number" && Number.isFinite(body.speed) && body.speed > 0 ? body.speed : null;
  if (!challengeMapId || !clientScoreId) return NextResponse.json({ error: "challengeMapId and clientScoreId are required." }, { status: 400 });

  const maps = await prisma.$queryRawUnsafe<MapRow[]>(`SELECT "id", "title", "rating", "length", "status", "isAutoImported", "rhpOverride" FROM "ChallengeMap" WHERE "id" = $1 LIMIT 1`, challengeMapId);
  const map = maps[0];
  if (!map || map.status !== "approved" || !map.isAutoImported || map.rating == null) return NextResponse.json({ error: "Map is not an approved Rhythians ranked map." }, { status: 404 });

  const users = await prisma.$queryRawUnsafe<Array<{ rhp: number }>>(`SELECT "rhp" FROM "User" WHERE "id" = $1 LIMIT 1`, installation.userId);
  const user = users[0];
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const rankIndex = getRankIndex(user.rhp);
  const [rangeMin, rangeMax] = getRankRange(rankIndex);
  if (map.rating < rangeMin || map.rating > rangeMax) return NextResponse.json({ error: "Map is outside the user's current rank range." }, { status: 409 });

  const points = map.rhpOverride ?? calculateRhp(map.rating, accuracy, speed, rankIndex, map.length);

  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`UPDATE "RhythKitInstallation" SET "lastSeenAt" = NOW() WHERE "installationId" = $1`, installation.installationId);
    const insertedScore = await tx.$queryRawUnsafe<Array<{ id: string }>>(`INSERT INTO "RhythKitScore" ("id", "userId", "installationId", "challengeMapId", "clientScoreId", "accuracy", "misses", "speed", "points", "rhpAwarded") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, 0, 0) ON CONFLICT ("installationId", "clientScoreId") DO NOTHING RETURNING "id"`, installation.userId, installation.installationId, challengeMapId, clientScoreId, accuracy, misses, speed);
    if (insertedScore.length === 0) return { duplicate: true, counted: false, points: 0, rhp: user.rhp };

    const insertedCompletion = await tx.$queryRawUnsafe<Array<{ id: string }>>(`INSERT INTO "ChallengeMapCompletion" ("id", "challengeMapId", "userId", "rating", "accuracy", "passed", "points", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, true, $5, NOW(), NOW()) ON CONFLICT ("challengeMapId", "userId") DO NOTHING RETURNING "id"`, challengeMapId, installation.userId, map.rating, accuracy, points);
    if (insertedCompletion.length === 0) return { duplicate: false, counted: false, points: 0, rhp: user.rhp };

    await tx.$executeRawUnsafe(`UPDATE "RhythKitScore" SET "points" = $1, "rhpAwarded" = $1 WHERE "id" = $2`, points, insertedScore[0].id);
    const updated = await tx.$queryRawUnsafe<Array<{ rhp: number }>>(`UPDATE "User" SET "rhp" = "rhp" + $1, "updatedAt" = NOW() WHERE "id" = $2 RETURNING "rhp"`, points, installation.userId);
    await tx.$executeRawUnsafe(`INSERT INTO "RhpTransaction" ("id", "userId", "amount", "reason", "description", "createdAt") VALUES (gen_random_uuid(), $1, $2, 'ranked_map', $3, NOW())`, installation.userId, points, `RhythKit completed ranked map [${map.id}]: ${map.title} (${map.rating.toFixed(2)})`);
    return { duplicate: false, counted: true, points, rhp: updated[0]?.rhp ?? user.rhp + points };
  });

  return NextResponse.json({ ok: true, duplicate: result.duplicate, counted: result.counted, map: { id: map.id, title: map.title, rating: map.rating }, points: result.points, rhp: result.rhp });
}
