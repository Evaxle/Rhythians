import { NextResponse } from "next/server";
import { getLiveStreamers, refreshLiveStreamers } from "@/lib/streaming";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const live = await refreshLiveStreamers();
    return NextResponse.json({ live }, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=30" } });
  } catch {
    const live = await getLiveStreamers().catch(() => []);
    return NextResponse.json({ live }, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=30" } });
  }
}
