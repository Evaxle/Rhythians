import { NextResponse } from "next/server";
import { getLiveStreamers, refreshLiveStreamers } from "@/lib/streaming";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const live = await refreshLiveStreamers();
    return NextResponse.json({ live });
  } catch {
    const live = await getLiveStreamers().catch(() => []);
    return NextResponse.json({ live });
  }
}
