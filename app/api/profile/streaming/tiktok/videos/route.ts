import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listTikTokVideos, saveTikTokProfilePosts } from "@/lib/tiktok";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  try {
    const videos = await listTikTokVideos(user.id);
    const selected = await (await import("@/lib/db")).prisma.$queryRawUnsafe<any[]>(`SELECT spp."postUrl",spp.position FROM "StreamerProfilePost" spp JOIN "StreamerAccount" sa ON sa.id=spp."accountId" WHERE sa."userId"=$1 AND sa.platform='tiktok' ORDER BY spp.position`, user.id);
    return NextResponse.json({ videos, selected });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "TikTok videos could not be loaded." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  try {
    const body = await request.json() as { videoIds?: unknown };
    if (!Array.isArray(body.videoIds) || body.videoIds.some(id => typeof id !== "string")) throw new Error("Invalid TikTok video selection.");
    const count = await saveTikTokProfilePosts(user.id, body.videoIds);
    return NextResponse.json({ ok: true, count });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "TikTok videos could not be saved." }, { status: 400 });
  }
}
