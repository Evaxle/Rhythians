import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getRankedMapsCached } from "@/lib/daily";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const query = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  const maps = await getRankedMapsCached();
  const filtered = maps.filter((map) => !query || map.title.toLowerCase().includes(query) || String(map.id).includes(query)).slice(0, 100).map((map) => ({ id: String(map.id), title: map.title, artist: null, starRating: map.starRating, length: map.length, downloadUrl: map.downloadUrl, imageUrl: map.imageUrl }));
  return NextResponse.json({ maps: filtered });
}
