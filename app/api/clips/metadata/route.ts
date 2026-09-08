import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { resolveExternalVideoMetadata } from "@/lib/external-video-metadata";
import type { ExternalClipSourceType } from "@/lib/clip-source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rate = checkRateLimit(request, "clip_metadata", 60, 60 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many video metadata requests. Try again shortly." }, { status: 429 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json().catch(() => null) as { sourceType?: unknown; sourceUrl?: unknown } | null;
  const sourceType = typeof body?.sourceType === "string" ? body.sourceType : "";
  const sourceUrl = typeof body?.sourceUrl === "string" ? body.sourceUrl.trim() : "";
  if (!(sourceType === "tiktok" || sourceType === "youtube" || sourceType === "twitch" || sourceType === "medal") || !sourceUrl) return NextResponse.json({ error: "Choose a supported video source and enter its URL." }, { status: 400 });
  try {
    const metadata = await resolveExternalVideoMetadata(sourceType as ExternalClipSourceType, sourceUrl);
    return NextResponse.json({ metadata });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not process that video URL." }, { status: 400 });
  }
}
