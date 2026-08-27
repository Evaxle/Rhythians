import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRankIndex, getRankRange } from "@/lib/rhythkit";
import { getRhythKitInstallation } from "@/lib/rhythkit-api";
import { rhpGainForMap } from "@/lib/ranks";

type ScoreBody = {
  challengeMapId?: unknown;
  accuracy?: unknown;
  misses?: unknown;
  speed?: unknown;
  clientScoreId?: unknown;
  resultQualified?: unknown;
  completedAt?: unknown;
  gameVersion?: unknown;
  integrationVersion?: unknown;
};

function isUuidV4(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export const runtime = "nodejs";

export async function GET(request: Request) {
  const installation = await getRhythKitInstallation(request);
  if (!installation) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  const rawLimit = Number(new URL(request.url).searchParams.get("limit"));
  const limit = Math.min(100, Math.max(1, Number.isInteger(rawLimit) ? rawLimit : 25));
  const rows = await prisma.$queryRawUnsafe<Array<{ title: string; rating: number | null; accuracy: number | null; misses: number | null; points: number; submittedAt: Date }>>(
    `SELECT cm."title", cm."rating", rs."accuracy", rs."misses", rs."points", rs."submittedAt" FROM "RhythKitScore" rs INNER JOIN "ChallengeMap" cm ON cm."id" = rs."challengeMapId" WHERE rs."userId" = $1 ORDER BY rs."submittedAt" DESC LIMIT $2`,
    installation.userId,
    limit
  );
  return NextResponse.json({
    ok: true,
    scores: rows.map((score) => ({
      title: score.title,
      rating: Math.max(0, Math.min(10, score.rating ?? 0)),
      accuracy: score.accuracy ?? 0,
      misses: Math.max(0, Math.trunc(score.misses ?? 0)),
      points: Math.trunc(score.points),
      submittedAt: score.submittedAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const installation = await getRhythKitInstallation(request);
  if (!installation) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as ScoreBody | null;
  const challengeMapId = typeof body?.challengeMapId === "string" ? body.challengeMapId.trim() : "";
  const clientScoreId = typeof body?.clientScoreId === "string" ? body.clientScoreId.trim() : "";
  const accuracy = typeof body?.accuracy === "number" && Number.isFinite(body.accuracy) ? body.accuracy : null;
  const misses = typeof body?.misses === "number" && Number.isInteger(body.misses) ? body.misses : null;
  const speed = typeof body?.speed === "number" && Number.isFinite(body.speed) ? body.speed : 1;
  const completedAt = typeof body?.completedAt === "string" ? new Date(body.completedAt) : null;

  if (!challengeMapId || !clientScoreId) return NextResponse.json({ ok: false, error: "challengeMapId and clientScoreId are required." }, { status: 400 });
  if (!isUuidV4(clientScoreId)) return NextResponse.json({ ok: false, error: "clientScoreId must be a UUID v4." }, { status: 400 });
  if (accuracy == null || accuracy < 0 || accuracy > 100) return NextResponse.json({ ok: false, error: "accuracy must be between 0 and 100." }, { status: 400 });
  if (misses == null || misses < 0 || misses > 1000000) return NextResponse.json({ ok: false, error: "misses must be a non-negative integer." }, { status: 400 });
  if (speed <= 0 || speed > 100) return NextResponse.json({ ok: false, error: "speed is invalid." }, { status: 400 });
  if (body?.resultQualified !== true) return NextResponse.json({ ok: false, error: "resultQualified must be true." }, { status: 409 });
  if (!completedAt || !Number.isFinite(completedAt.getTime())) return NextResponse.json({ ok: false, error: "completedAt must be a valid ISO8601 timestamp." }, { status: 400 });
  if (completedAt.getTime() > Date.now() + 5 * 60 * 1000) return NextResponse.json({ ok: false, error: "completedAt cannot be in the future." }, { status: 400 });
  if (completedAt.getTime() < Date.now() - 7 * 24 * 60 * 60 * 1000) return NextResponse.json({ ok: false, error: "completedAt is too old." }, { status: 400 });

  const result = await prisma.$transaction(async (tx) => {
    const duplicate = await tx.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id" FROM "RhythKitScore" WHERE "installationId" = $1 AND "clientScoreId" = $2 LIMIT 1`,
      installation.installationId,
      clientScoreId
    );
    if (duplicate.length > 0) return { kind: "duplicate" as const };

    const maps = await tx.$queryRawUnsafe<Array<{ id: string; title: string; rating: number | null; length: number | null; status: string; reviewerNote: string | null }>>(
      `SELECT "id", "title", "rating", "length", "status", "reviewerNote" FROM "ChallengeMap" WHERE "id" = $1 LIMIT 1`,
      challengeMapId
    );
    const map = maps[0];
    if (!map || (map.status !== "approved" && map.status !== "legacy")) return { kind: "not_found" as const };

    const users = await tx.$queryRawUnsafe<Array<{ rhp: number; isSuspended: boolean; suspendedUntil: Date | null }>>(
      `SELECT "rhp", "isSuspended", "suspendedUntil" FROM "User" WHERE "id" = $1 LIMIT 1`,
      installation.userId
    );
    const user = users[0];
    if (!user) return { kind: "unauthorized" as const };
    if (user.isSuspended && (!user.suspendedUntil || user.suspendedUntil > new Date())) return { kind: "suspended" as const };

    const existingCompletion = await tx.$queryRawUnsafe<Array<{ id: string; passed: boolean }>>(
      `SELECT "id", "passed" FROM "ChallengeMapCompletion" WHERE "challengeMapId" = $1 AND "userId" = $2 LIMIT 1`,
      challengeMapId,
      installation.userId
    );
    if (existingCompletion[0]?.passed) return { kind: "already_completed" as const };

    const ranked = map.status === "approved" && map.rating != null && map.reviewerNote !== "rhythia-unranked";
    const legacy = map.status === "legacy";
    const rankIndex = getRankIndex(user.rhp);
    const [minRating, maxRating] = getRankRange(rankIndex);
    const eligibleForRhp = legacy || (ranked && map.rating != null && map.rating >= minRating && map.rating <= maxRating);
    const calculatedPoints = eligibleForRhp && map.rating != null ? rhpGainForMap(map.rating, accuracy, speed, rankIndex, map.length != null ? map.length / 1000 : null) : 0;
    const points = legacy ? Math.min(25, calculatedPoints) : calculatedPoints;
    const scoreId = crypto.randomUUID();

    const inserted = await tx.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO "RhythKitScore" ("id", "userId", "installationId", "challengeMapId", "clientScoreId", "accuracy", "misses", "speed", "points", "rhpAwarded", "submittedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, NOW()) ON CONFLICT ("installationId", "clientScoreId") DO NOTHING RETURNING "id"`,
      scoreId,
      installation.userId,
      installation.installationId,
      challengeMapId,
      clientScoreId,
      accuracy,
      misses,
      speed,
      points
    );
    if (inserted.length === 0) return { kind: "duplicate" as const };

    const completion = await tx.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO "ChallengeMapCompletion" ("id", "challengeMapId", "userId", "rating", "accuracy", "passed", "points", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, true, $6, NOW(), NOW()) ON CONFLICT ("challengeMapId", "userId") DO NOTHING RETURNING "id"`,
      crypto.randomUUID(),
      challengeMapId,
      installation.userId,
      map.rating ?? 0,
      accuracy,
      points
    );
    if (completion.length === 0) return { kind: "already_completed" as const };

    if (points > 0) {
      const updated = await tx.$queryRawUnsafe<Array<{ rhp: number }>>(
        `UPDATE "User" SET "rhp" = "rhp" + $1, "avgMapRating" = CASE WHEN "avgMapRating" IS NULL THEN $2 ELSE "avgMapRating" END, "updatedAt" = NOW() WHERE "id" = $3 RETURNING "rhp"`,
        points,
        map.rating,
        installation.userId
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO "RhpTransaction" ("id", "userId", "amount", "reason", "description", "createdAt") VALUES ($1, $2, $3, $4, $5, NOW())`,
        crypto.randomUUID(),
        installation.userId,
        points,
        legacy ? "legacy_map" : "ranked_map",
        `RhythKit completed ${legacy ? "legacy" : "ranked"} map [${map.id}]: ${map.title}`
      );
      return { kind: "success" as const, points, rhp: updated[0]?.rhp ?? user.rhp + points };
    }

    return { kind: "success" as const, points: 0, rhp: user.rhp };
  });

  if (result.kind === "duplicate") return NextResponse.json({ ok: false, error: "duplicate" }, { status: 409 });
  if (result.kind === "already_completed") return NextResponse.json({ ok: false, error: "already_submitted" }, { status: 409 });
  if (result.kind === "not_found") return NextResponse.json({ ok: false, error: "Map not found." }, { status: 404 });
  if (result.kind === "unauthorized") return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  if (result.kind === "suspended") return NextResponse.json({ ok: false, error: "Account is suspended." }, { status: 403 });
  return NextResponse.json({ ok: true, points: result.points });
}
