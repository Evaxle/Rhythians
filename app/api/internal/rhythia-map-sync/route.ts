import { NextResponse } from "next/server";
import { syncRhythiaMaps } from "@/lib/rhythia-map-sync";
import { checkRateLimit } from "@/lib/security";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return request.headers.get("x-vercel-cron") === "1";
  const url = new URL(request.url);
  const bearer = request.headers.get("authorization");
  return bearer === `Bearer ${secret}` || url.searchParams.get("secret") === secret || request.headers.get("x-cron-secret") === secret;
}

export async function GET(request: Request) {
  const rate = checkRateLimit(request, "rhythia_map_sync", 2, 60 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ success: true, ...(await syncRhythiaMaps()) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Map synchronization failed." }, { status: 500 });
  }
}
