import { NextResponse } from "next/server";
import { getLiveStreamers, refreshLiveStreamers } from "@/lib/streaming";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const live = await refreshLiveStreamers();
    return NextResponse.json({ live }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  } catch {
    const live = await getLiveStreamers().catch(() => []);
    return NextResponse.json({ live }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  }
}
