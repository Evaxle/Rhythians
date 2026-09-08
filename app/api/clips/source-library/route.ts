import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listTikTokVideos } from "@/lib/tiktok";
import { listTwitchClips } from "@/lib/twitch";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const platform = new URL(request.url).searchParams.get("platform");
  if (platform !== "tiktok" && platform !== "twitch") return NextResponse.json({ error: "Invalid platform." }, { status: 400 });

  const account = (await prisma.$queryRawUnsafe<Array<{ username: string; profileUrl: string }>>(
    `SELECT username,"profileUrl" FROM "StreamerAccount" WHERE "userId"=$1 AND platform=$2 AND verified=TRUE LIMIT 1`,
    user.id,
    platform,
  ))[0];
  if (!account) return NextResponse.json({ linked: false, items: [] });

  try {
    if (platform === "tiktok") {
      const videos = await listTikTokVideos(user.id);
      return NextResponse.json({
        linked: true,
        account,
        items: videos.map((video: any) => ({
          id: String(video.id),
          title: String(video.title || video.video_description || "TikTok video"),
          description: String(video.video_description || ""),
          url: String(video.share_url || `https://www.tiktok.com/video/${video.id}`),
          thumbnailUrl: video.cover_image_url ? String(video.cover_image_url) : null,
          duration: typeof video.duration === "number" ? video.duration : null,
          createdAt: video.create_time ? new Date(Number(video.create_time) * 1000).toISOString() : null,
        })),
      });
    }

    return NextResponse.json({ linked: true, account, items: await listTwitchClips(user.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Videos could not be loaded." }, { status: 400 });
  }
}
