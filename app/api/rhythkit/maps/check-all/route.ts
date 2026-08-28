import { NextResponse } from "next/server";
import { getRhythKitInstallation } from "@/lib/rhythkit-api";
import { checkAllRankedMaps } from "@/lib/ranked-map-check";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const installation = await getRhythKitInstallation(request);
  if (!installation) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  try {
    const result = await checkAllRankedMaps(installation.userId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to check your scores." }, { status: 400 });
  }
}
