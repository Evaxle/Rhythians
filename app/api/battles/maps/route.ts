import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const query = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  const maps = await prisma.$queryRawUnsafe<any[]>(`SELECT id,title,artist,rating,length,"mapFileUrl","imageUrl" FROM "ChallengeMap" WHERE status='approved' AND ($1='' OR LOWER(title) LIKE '%' || $1 || '%' OR CAST("sourceBeatmapId" AS TEXT) LIKE '%' || $1 || '%') ORDER BY rating NULLS LAST,title LIMIT 100`, query);
  return NextResponse.json({ maps: maps.map((map) => ({ id: map.id, title: map.title, artist: map.artist, starRating: map.rating, length: map.length, downloadUrl: map.mapFileUrl, imageUrl: map.imageUrl })) });
}
