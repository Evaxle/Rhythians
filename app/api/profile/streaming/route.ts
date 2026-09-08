import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { prisma } from "@/lib/db";

type Platform = "twitch" | "tiktok";
function platform(value: unknown): Platform | null { return value === "twitch" || value === "tiktok" ? value : null; }

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const accounts = await prisma.$queryRawUnsafe<any[]>(`SELECT platform,username,"profileUrl",verified,"verifiedAt","showProfilePosts" FROM "StreamerAccount" WHERE "userId"=$1 ORDER BY platform`, user.id);
  return NextResponse.json({ accounts });
}

export async function POST(request: Request) {
  const rate = checkRateLimit(request, "streamer_account", 20, 60 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many account updates. Try again later." }, { status: 429 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const p = platform(body?.platform);
  if (!p) return NextResponse.json({ error: "Choose Twitch or TikTok." }, { status: 400 });
  if (body?.action !== "unlink") return NextResponse.json({ error: `${p === "twitch" ? "Twitch" : "TikTok"} accounts are connected through OAuth.` }, { status: 400 });
  await prisma.$executeRawUnsafe(`DELETE FROM "StreamerAccount" WHERE "userId"=$1 AND platform=$2`, user.id, p);
  return NextResponse.json({ ok: true });
}
