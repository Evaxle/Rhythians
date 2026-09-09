import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { getMapAnalysis, MAP_ANALYZER_VERSION, UNRANKED_MAP_MARKER } from "@/lib/map-analysis-store";
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
  if (source === "ranked") filters.push({ status: "approved", OR: [{ reviewerNote: null }, { reviewerNote: { not: UNRANKED_MAP_MARKER } }] });
  else if (source === "unranked") filters.push({ status: "approved", reviewerNote: UNRANKED_MAP_MARKER });
  else if (source === "legacy") filters.push({ status: "legacy" });
  else filters.push({ status: { in: ["approved", "legacy"] } });
  if (query) filters.push({ OR: [{ title: { contains: query, mode: "insensitive" } }, { mapperName: { contains: query, mode: "insensitive" } }] });
  const where: Prisma.ChallengeMapWhereInput = { AND: filters };
  const [total, maps] = await Promise.all([
    prisma.challengeMap.count({ where }),
    prisma.challengeMap.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], skip: (page - 1) * 10, take: 10, select: { id: true, title: true, artist: true, mapperName: true, rating: true, noteCount: true, length: true, status: true, reviewerNote: true, sourceBeatmapId: true, sourceUrl: true, mapFileUrl: true, isAutoImported: true, updatedAt: true } }),
  ]);
  const rows = await Promise.all(maps.map(async (map) => {
    const analysis = await getMapAnalysis(map.id);
    const sourceStatus = map.reviewerNote === UNRANKED_MAP_MARKER ? "unranked" : map.status === "legacy" ? "legacy" : "ranked";
    const analysisStatus = !analysis ? "unanalyzed" : analysis.status === "analyzed" && analysis.analyzerVersion !== MAP_ANALYZER_VERSION ? "stale" : analysis.status;
    return { ...map, updatedAt: map.updatedAt.toISOString(), sourceStatus, analysisStatus, analysis };
  }));
  return NextResponse.json({ maps: rows, page, pageSize: 10, total, pages: Math.max(1, Math.ceil(total / 10)), analyzerVersion: MAP_ANALYZER_VERSION });
}
