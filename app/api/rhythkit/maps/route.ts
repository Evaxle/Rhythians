import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRankIndex } from "@/lib/rhythkit";
import { getMapRankMeta, getRhythKitInstallation, isMapAllowed, isRankedMap, mapLengthSeconds, safeLimit, safeMapRating } from "@/lib/rhythkit-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const installation = await getRhythKitInstallation(request);
  if (!installation) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  const users = await prisma.$queryRawUnsafe<Array<{ rhp: number }>>(`SELECT "rhp" FROM "User" WHERE "id" = $1 LIMIT 1`, installation.userId);
  const user = users[0];
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  const rankIndex = getRankIndex(user.rhp);
  const url = new URL(request.url);
  const limit = safeLimit(url.searchParams.get("limit"), 100, 500);
  const rows = await prisma.$queryRawUnsafe<Array<{
    id: string;
    title: string;
    artist: string | null;
    mapper: string | null;
    submitter: string | null;
    noteCount: number | null;
    length: number | null;
    rating: number | null;
    status: string;
    reviewerNote: string | null;
    hasScore: boolean;
    passed: boolean | null;
    completionPoints: number | null;
  }>>(`
    SELECT
      cm."id",
      cm."title",
      cm."artist",
      cm."mapperName" AS "mapper",
      u."username" AS "submitter",
      cm."noteCount",
      cm."length",
      cm."rating",
      cm."status",
      cm."reviewerNote",
      EXISTS (SELECT 1 FROM "RhythKitScore" rs WHERE rs."userId" = $1 AND rs."challengeMapId" = cm."id") AS "hasScore",
      c."passed",
      c."points" AS "completionPoints"
    FROM "ChallengeMap" cm
    LEFT JOIN "User" u ON u."id" = cm."submittedById"
    LEFT JOIN "ChallengeMapCompletion" c ON c."challengeMapId" = cm."id" AND c."userId" = $1
    WHERE cm."status" IN ('approved', 'legacy')
    ORDER BY cm."rating" ASC NULLS LAST, cm."createdAt" DESC
    LIMIT $2
  `, installation.userId, limit);

  const maps = rows
    .filter((map) => isMapAllowed(map.rating, map.reviewerNote, map.status, rankIndex))
    .map((map) => {
      const ranked = isRankedMap(map.rating, map.reviewerNote, map.status);
      const rating = safeMapRating(map.rating);
      const rankMeta = getMapRankMeta(rating);
      return {
        id: map.id,
        title: map.title,
        artist: map.artist ?? "Unknown Artist",
        mapper: map.mapper ?? map.submitter ?? "Unknown",
        curatedBy: map.mapper ?? map.submitter ?? "Unknown",
        length: mapLengthSeconds(map.length),
        noteCount: Math.max(0, Math.floor(map.noteCount ?? 0)),
        notes: Math.max(0, Math.floor(map.noteCount ?? 0)),
        rating,
        isRanked: ranked,
        isLegacy: map.status === "legacy",
        rankName: ranked ? rankMeta.name : map.status === "legacy" ? "Legacy" : "Unranked",
        rankColor: ranked ? rankMeta.color : map.status === "legacy" ? "#94a3b8" : "#64748b",
        hasScore: map.hasScore,
        completion: {
          passed: map.passed === true,
          points: Math.trunc(map.completionPoints ?? 0),
        },
      };
    });

  return NextResponse.json({ ok: true, maps });
}
