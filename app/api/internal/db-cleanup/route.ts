import { NextResponse } from "next/server";
import { runDbCleanup } from "@/lib/db-cleanup";
import { checkRateLimit } from "@/lib/security";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const url = new URL(request.url);
    const provided = url.searchParams.get("secret") ?? request.headers.get("x-cron-secret");
    return provided === secret;
  }
  return request.headers.get("x-vercel-cron") === "1";
}

export async function GET(request: Request) {
  const rate = checkRateLimit(request, "internal_db_cleanup", 5, 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } });
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await runDbCleanup();
  return NextResponse.json({ success: true, results });
}
