import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashToken, calculateRhp, getRankIndex, getRankRange } from "@/lib/rhythkit";

export const runtime = "nodejs";

type Installation = { userId: string; installationId: string; revokedAt: Date | null };
type MapRow = { id: string; title: string; rating: number | null; length: number | null; status: string; rhpOverride: number | null };

export async function POST(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return NextResponse.json({ error: "Authorization required." }, { status: 401 });
  const installations = await prisma.$queryRawUnsafe<Installation[]>(`SELECT "userId", "installationId", "revokedAt" FROM "RhythKitInstallation" WHERE "tokenHash" = $1 LIMIT 1`, hashToken(token));
  const installation = installations[0];
  if (!installation || installation.revokedAt) return NextResponse.json({ error: "Invalid Rhythians installation." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { challengeMapId?: unknown; clientScoreId?: unknown; accuracy?: unknown; misses?: unknown; speed?: unknown; gameVersion?: unknown; integrationVersion?: unknown; completedAt?: unknown; resultQualified?: unknown } | null;
  const challengeMapId = typeof body?.challengeMapId === "string" ? body.challengeMapId.trim() : "";
  const clientScoreId = typeof body?.clientScoreId === "string" ? body.clientScoreId.trim() : "";
  const accuracy = typeof body?.accuracy === "number" && Number.isFinite(body.accuracy) ? body.accuracy : null;
  const misses = typeof body?.misses === "number" && Number.isInteger(body.misses) ? body.misses : null;
  const speed = typeof body?.speed === "number" && Number.isFinite(body.speed) ? body.speed : null;
  const gameVersion = typeof body?.gameVersion === "string" ? body.gameVersion.trim() : "";
  const integrationVersion = typeof body?.integrationVersion === "string" ? body.integrationVersion.trim() : "";
  const completedAt = typeof body?.completedAt === "string" ? new Date(body.completedAt) : new Date();
  const resultQualified = body?.resultQualified === true;
  if (!challengeMapId || !clientScoreId) return NextResponse.json({ error: "challengeMapId and clientScoreId are required." }, { status: 400 });
  if (clientScoreId.length > 128) return NextResponse.json({ error: "clientScoreId is too long." }, { status: 400 });
  if (accuracy == null || accuracy < 0 || accuracy > 100) return NextResponse.json({ error: "A valid accuracy is required." }, { status: 400 });
  if (misses == null || misses < 0 || misses > 1000000) return NextResponse.json({ error: "A valid miss count is required." }, { status: 400 });
  if (speed != null && (speed <= 0 || speed > 100)) return NextResponse.json({ error: "Invalid speed." }, { status: 400 });
  if (!resultQualified) return NextResponse.json({ error: "The game did not qualify this result for a ranked completion." }, { status: 409 });
  if (!Number.isFinite(completedAt.getTime())) return NextResponse.json({ error: "Invalid completion time." }, { status: 400 });
  if (completedAt.getTime() > Date.now() + 5 * 60 * 1000) return NextResponse.json({ error: "Completion time is in the future." }, { status: 400 });
  if (completedAt.getTime() < Date.now() - 7 * 24 * 60 * 60 * 1000) return NextResponse.json({ error: "Completion is too old." }, { status: 400 });
  const maps = await prisma.$queryRawUnsafe<MapRow[]>(`SELECT "id", "title", "rating", "length", "status", "rhpOverride" FROM "ChallengeMap" WHERE "id" = $1 LIMIT 1`, challengeMapId);
  const map = maps[0];
  if (!map || map.status !== "approved" || map.rating == null) return NextResponse.json({ error: "Map is not an approved Rhythians ranked map." }, { status: 404 });
  const rating = map.rating;
  const users = await prisma.$queryRawUnsafe<Array<{ rhp: number; isSuspended: boolean; suspendedUntil: Date | null }>>(`SELECT "rhp", "isSuspended", "suspendedUntil" FROM "User" WHERE "id" = $1 LIMIT 1`, installation.userId);
  const user = users[0];
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (user.isSuspended && (!user.suspendedUntil || user.suspendedUntil > new Date())) return NextResponse.json({ error: "Account is suspended." }, { status: 403 });
  const rankIndex = getRankIndex(user.rhp);
  const [rangeMin, rangeMax] = getRankRange(rankIndex);
  if (rating < rangeMin || rating > rangeMax) return NextResponse.json({ error: "Map is outside the user's current rank range." }, { status: 409 });
  const points = map.rhpOverride ?? calculateRhp(rating, accuracy, speed, rankIndex, map.length);
  if (!Number.isFinite(points) || points < 0) return NextResponse.json({ error: "Invalid calculated score." }, { status: 422 });
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`UPDATE "RhythKitInstallation" SET "lastSeenAt" = NOW() WHERE "installationId" = $1`, installation.installationId);
    const existingCompletion = await tx.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id" FROM "ChallengeMapCompletion" WHERE "challengeMapId" = $1 AND "userId" = $2 LIMIT 1`, challengeMapId, installation.userId);
    if (existingCompletion.length > 0) return { duplicate: false, counted: false, alreadyCompleted: true, points: 0, rhp: user.rhp };
    const insertedScore = await tx.$queryRawUnsafe<Array<{ id: string }>>(`INSERT INTO "RhythKitScore" ("id", "userId", "installationId", "challengeMapId", "clientScoreId", "accuracy", "misses", "speed", "points", "rhpAwarded") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, 0, 0) ON CONFLICT ("installationId", "clientScoreId") DO NOTHING RETURNING "id"`, installation.userId, installation.installationId, challengeMapId, clientScoreId, accuracy, misses, speed);
    if (insertedScore.length === 0) return { duplicate: true, counted: false, alreadyCompleted: false, points: 0, rhp: user.rhp };
    const insertedCompletion = await tx.$queryRawUnsafe<Array<{ id: string }>>(`INSERT INTO "ChallengeMapCompletion" ("id", "challengeMapId", "userId", "rating", "accuracy", "passed", "points", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, true, $5, NOW(), NOW()) ON CONFLICT ("challengeMapId", "userId") DO NOTHING RETURNING "id"`, challengeMapId, installation.userId, rating, accuracy, points);
    if (insertedCompletion.length === 0) return { duplicate: false, counted: false, alreadyCompleted: true, points: 0, rhp: user.rhp };
    await tx.$executeRawUnsafe(`UPDATE "RhythKitScore" SET "points" = $1, "rhpAwarded" = $1 WHERE "id" = $2`, points, insertedScore[0].id);
    const updated = await tx.$queryRawUnsafe<Array<{ rhp: number }>>(`UPDATE "User" SET "rhp" = "rhp" + $1, "updatedAt" = NOW() WHERE "id" = $2 RETURNING "rhp"`, points, installation.userId);
    await tx.$executeRawUnsafe(`INSERT INTO "RhpTransaction" ("id", "userId", "amount", "reason", "description", "createdAt") VALUES (gen_random_uuid(), $1, $2, 'ranked_map', $3, NOW())`, installation.userId, points, `RhythKit completed ranked map [${map.id}]: ${map.title} (${rating.toFixed(2)})`);
    await tx.$executeRawUnsafe(`INSERT INTO public.rhythkit_maps (user_id, map_id, map_name, completed_at, matched_map_id, ranked, rhp_awarded, processed_at) VALUES ($1, $2, $3, $4, $2, true, $5, NOW())`, installation.userId, map.id, map.title, completedAt, points);
    return { duplicate: false, counted: true, alreadyCompleted: false, points, rhp: updated[0]?.rhp ?? user.rhp + points };
  });
  return NextResponse.json({ ok: true, duplicate: result.duplicate, counted: result.counted, alreadyCompleted: result.alreadyCompleted, map: { id: map.id, title: map.title, rating }, points: result.points, rhp: result.rhp, gameVersion: gameVersion || null, integrationVersion: integrationVersion || null });
}
