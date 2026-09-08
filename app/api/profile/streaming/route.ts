import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { checkStreamerVerification, startStreamerVerification, type StreamPlatform } from "@/lib/streaming";
import { prisma } from "@/lib/db";

function platform(value: unknown): StreamPlatform | null { return value === "twitch" || value === "tiktok" ? value : null; }

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const accounts = await prisma.$queryRawUnsafe<any[]>(`SELECT platform,username,"profileUrl",verified,"verifiedAt","showProfilePosts" FROM "StreamerAccount" WHERE "userId"=$1 ORDER BY platform`, user.id);
  return NextResponse.json({ accounts });
}

export async function POST(request: Request) {
  const rate = checkRateLimit(request, "streamer_verify", 20, 60 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many verification attempts. Try again later." }, { status: 429 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const p = platform(body?.platform);
  if (!p) return NextResponse.json({ error: "Choose Twitch or TikTok." }, { status: 400 });
  try {
    if (body?.action === "start") {
      if (typeof body.url !== "string") throw new Error("Profile URL is required.");
      return NextResponse.json(await startStreamerVerification(user.id, p, body.url));
    }
    if (body?.action === "check") return NextResponse.json(await checkStreamerVerification(user.id, p));
    if (body?.action === "unlink") {
      await prisma.$executeRawUnsafe(`DELETE FROM "StreamerAccount" WHERE "userId"=$1 AND platform=$2`, user.id, p);
      return NextResponse.json({ ok: true });
    }
    throw new Error("Unknown action.");
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Streamer account update failed." }, { status: 400 });
  }
}
