import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getRankInfo } from "@/lib/ranks";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim().toLowerCase() ?? "";
  const lobbyId = params.get("lobbyId");
  let defaultRankIndex = getRankInfo(user.rhp).index;
  if (lobbyId) {
    const members = await prisma.$queryRawUnsafe<Array<{ rhp: number }>>(`SELECT u.rhp FROM "BattleLobbyMember" m JOIN "User" u ON u.id=m."userId" WHERE m."lobbyId"=$1`, lobbyId);
    if (members.length) defaultRankIndex = Math.min(...members.map((member) => getRankInfo(member.rhp).index));
  }
  const rank = getRankInfo(defaultRankIndex);
  const maps = await prisma.$queryRawUnsafe<any[]>(`SELECT id,title,artist,rating,length,"mapFileUrl","imageUrl" FROM "ChallengeMap" WHERE status::text IN ('approved','legacy') AND rating IS NOT NULL AND ($1='' OR LOWER(title) LIKE '%' || $1 || '%' OR LOWER(COALESCE(artist,'')) LIKE '%' || $1 || '%' OR CAST("sourceBeatmapId" AS TEXT) LIKE '%' || $1 || '%') ORDER BY CASE WHEN rating >= $2 AND rating <= $3 THEN 0 ELSE 1 END,rating NULLS LAST,title LIMIT 100`, query, rank.rangeMin, rank.rangeMax);
  return NextResponse.json({ maps: maps.map((map) => ({ id: map.id, title: map.title, artist: map.artist, starRating: map.rating, length: map.length, downloadUrl: map.mapFileUrl, imageUrl: map.imageUrl })) , defaultRank: { index: defaultRankIndex, name: rank.name, tier: rank.tier, rangeMin: rank.rangeMin, rangeMax: rank.rangeMax } });
}
