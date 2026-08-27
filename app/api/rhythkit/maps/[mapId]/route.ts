import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRankIndex } from "@/lib/rhythkit";
import { getRhythKitInstallation, isMapAllowed, isRankedMap } from "@/lib/rhythkit-api";
import { normalizeRhythiaSourceId } from "@/lib/rhythia-map-sync";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const installation = await getRhythKitInstallation(request);
  if (!installation) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  const { mapId } = await params;
  const numericMapId = /^\d+$/.test(mapId) ? Number(mapId) : null;
  const sourceMapId = numericMapId == null ? null : normalizeRhythiaSourceId(numericMapId);
  const maps = sourceMapId == null
    ? await prisma.$queryRawUnsafe<Array<{ id: string; title: string; rating: number | null; length: number | null; status: string; sourceBeatmapId: number | null; reviewerNote: string | null }>>(`SELECT "id", "title", "rating", "length", "status", "sourceBeatmapId", "reviewerNote" FROM "ChallengeMap" WHERE "id" = $1 LIMIT 1`, mapId)
    : await prisma.$queryRawUnsafe<Array<{ id: string; title: string; rating: number | null; length: number | null; status: string; sourceBeatmapId: number | null; reviewerNote: string | null }>>(`SELECT "id", "title", "rating", "length", "status", "sourceBeatmapId", "reviewerNote" FROM "ChallengeMap" WHERE "sourceBeatmapId" = $1 LIMIT 1`, sourceMapId);
  const map = maps[0];
  if (!map || (map.status !== "approved" && map.status !== "legacy")) return NextResponse.json({ ok: false, error: "Map not found." }, { status: 404 });
  const users = await prisma.$queryRawUnsafe<Array<{ rhp: number }>>(`SELECT "rhp" FROM "User" WHERE "id" = $1 LIMIT 1`, installation.userId);
  const user = users[0];
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  if (!isMapAllowed(map.rating, map.reviewerNote, map.status, getRankIndex(user.rhp))) return NextResponse.json({ ok: false, error: "Map is outside your current rank range." }, { status: 403 });
  return NextResponse.json({
    ok: true,
    id: map.id,
    rhythiaMapId: numericMapId?.toString() ?? map.sourceBeatmapId?.toString() ?? mapId,
    title: map.title,
    rating: map.rating ?? 0,
    length: map.length == null ? 0 : Math.max(0, Math.round(map.length / 1000)),
    eligible: true,
    isRanked: isRankedMap(map.rating, map.reviewerNote, map.status),
    isLegacy: map.status === "legacy",
    downloadUrl: `/api/rhythkit/maps/${encodeURIComponent(map.id)}/download`,
  });
}
