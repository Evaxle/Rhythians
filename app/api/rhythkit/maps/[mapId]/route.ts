import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/rhythkit";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return NextResponse.json({ error: "Authorization required." }, { status: 401 });

  const installations = await prisma.$queryRawUnsafe<Array<{ id: string; revokedAt: Date | null }>>(`SELECT "installationId" AS id, "revokedAt" FROM "RhythKitInstallation" WHERE "tokenHash" = $1 LIMIT 1`, hashToken(token));
  if (!installations[0] || installations[0].revokedAt) return NextResponse.json({ error: "Invalid RhythKit installation." }, { status: 401 });

  const { mapId } = await params;
  const numericMapId = /^\d+$/.test(mapId) ? Number(mapId) : null;
  const maps = numericMapId == null
    ? await prisma.$queryRawUnsafe<Array<{ id: string; title: string; rating: number | null; length: number | null; status: string; sourceBeatmapId: number | null }>>(`SELECT "id", "title", "rating", "length", "status", "sourceBeatmapId" FROM "ChallengeMap" WHERE "id" = $1 LIMIT 1`, mapId)
    : await prisma.$queryRawUnsafe<Array<{ id: string; title: string; rating: number | null; length: number | null; status: string; sourceBeatmapId: number | null }>>(`SELECT "id", "title", "rating", "length", "status", "sourceBeatmapId" FROM "ChallengeMap" WHERE "sourceBeatmapId" = $1 LIMIT 1`, numericMapId);
  const map = maps[0];
  if (!map || map.status !== "approved" || map.rating == null) return NextResponse.json({ error: "Map is not an approved Rhythians ranked map." }, { status: 404 });

  return NextResponse.json({ id: map.id, rhythiaMapId: map.sourceBeatmapId?.toString() ?? mapId, title: map.title, rating: map.rating, length: map.length, eligible: true });
}
