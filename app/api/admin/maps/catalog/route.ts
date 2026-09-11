import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { getMapAnalysis, MAP_ANALYZER_VERSION, UNRANKED_MAP_MARKER } from "@/lib/map-analysis-store";
import { mapRankabilityBreakdown, RANKABILITY_ANALYZER_VERSION } from "@/lib/map-rankability";
import { challengeCategoryFits, CHALLENGE_FIT_ANALYZER_VERSION } from "@/lib/challenge-map-fit";
import type { MapSectionAnalysis } from "@/lib/map-difficulty";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!(await canAccessAdmin(user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const source = url.searchParams.get("source") ?? "all";
  const query = url.searchParams.get("q")?.trim() ?? "";
  const filters: Prisma.ChallengeMapWhereInput[] = [];

  if (source === "ranked") {
    filters.push({
      status: "approved",
      OR: [{ reviewerNote: null }, { reviewerNote: { not: UNRANKED_MAP_MARKER } }],
    });
  } else if (source === "unranked") {
    filters.push({ status: "approved", reviewerNote: UNRANKED_MAP_MARKER });
  } else if (source === "legacy") {
    filters.push({ status: "legacy" });
  } else {
    filters.push({ status: { in: ["approved", "legacy"] } });
  }

  if (query) {
    filters.push({
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { mapperName: { contains: query, mode: "insensitive" } },
        { artist: { contains: query, mode: "insensitive" } },
      ],
    });
  }

  const where: Prisma.ChallengeMapWhereInput = { AND: filters };
  const [total, maps] = await Promise.all([
    prisma.challengeMap.count({ where }),
    prisma.challengeMap.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * 10,
      take: 10,
      select: {
        id: true,
        title: true,
        artist: true,
        mapperName: true,
        imageUrl: true,
        rating: true,
        noteCount: true,
        length: true,
        status: true,
        reviewerNote: true,
        sourceBeatmapId: true,
        sourceUrl: true,
        mapFileUrl: true,
        isAutoImported: true,
        updatedAt: true,
      },
    }),
  ]);

  const rows = await Promise.all(maps.map(async (map) => {
    const analysis = await getMapAnalysis(map.id);
    const sourceStatus: "ranked" | "unranked" | "legacy" =
      map.reviewerNote === UNRANKED_MAP_MARKER
        ? "unranked"
        : map.status === "legacy"
          ? "legacy"
          : "ranked";

    const analysisStatus =
      !analysis
        ? "unanalyzed"
        : analysis.status === "analyzed" && analysis.analyzerVersion !== MAP_ANALYZER_VERSION
          ? "stale"
          : analysis.status;

    const current = analysis?.status === "analyzed" && analysis.analyzerVersion === MAP_ANALYZER_VERSION;
    const topSections = (analysis?.topSections ?? []) as MapSectionAnalysis[];

    const rankability = current && analysis
      ? mapRankabilityBreakdown({
        noteCount: map.noteCount,
        activeDurationMs: analysis.activeDurationMs ?? 0,
        patternSegments: analysis.patternSegments,
        topSections,
        details: analysis.analysisDetails,
        directionScore: analysis.directionScore ?? 0,
        distanceScore: analysis.distanceScore ?? 0,
        npsScore: analysis.npsScore ?? 0,
        sourceStatus,
      })
      : null;

    const challengeFits = current && analysis?.rating != null
      ? challengeCategoryFits({
        rating: analysis.rating,
        directionScore: analysis.directionScore ?? 0,
        distanceScore: analysis.distanceScore ?? 0,
        npsScore: analysis.npsScore ?? 0,
        staminaIndex: analysis.staminaIndex ?? 0,
        peakJumpNps: analysis.peakJumpNps ?? 0,
        peakStreamNps: analysis.peakStreamNps ?? 0,
        peakJumpStrain: analysis.peakJumpStrain ?? 0,
        peakStreamStrain: analysis.peakStreamStrain ?? 0,
        jumpRatio: analysis.jumpRatio ?? 0,
        patternSegments: analysis.patternSegments,
        topSections,
        details: analysis.analysisDetails,
      })
      : [];

    return {
      ...map,
      updatedAt: map.updatedAt.toISOString(),
      sourceStatus,
      analysisStatus,
      analysis,
      rankability,
      challengeFits,
    };
  }));

  return NextResponse.json({
    maps: rows,
    page,
    pageSize: 10,
    total,
    pages: Math.max(1, Math.ceil(total / 10)),
    analyzerVersion: MAP_ANALYZER_VERSION,
    rankabilityVersion: RANKABILITY_ANALYZER_VERSION,
    challengeFitVersion: CHALLENGE_FIT_ANALYZER_VERSION,
  });
}
