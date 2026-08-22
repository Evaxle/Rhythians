import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { checkRecentPathScore } from "@/lib/seasonal-path";
import { checkRateLimit } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rate = checkRateLimit(request, "path_score_check", 20, 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } });

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  let body: { rankIndex?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const rankIndex = typeof body.rankIndex === "number" && Number.isInteger(body.rankIndex) ? body.rankIndex : -1;
  if (rankIndex < 0) return NextResponse.json({ error: "Invalid path rank." }, { status: 400 });

  const result = await checkRecentPathScore(user.id, rankIndex);
  const messages: Record<string, string> = {
    completed: "Recent unmodified score found. Path rank completed.",
    not_found: "No eligible recent score found. Repass this map at normal speed, then check again.",
    previous_required: "Complete the previous path rank first.",
    locked: "This path rank is above your current playable rank.",
    no_profile: "Link your Rhythia account first.",
    rhythia_error: "Rhythia could not be checked right now. Try again shortly.",
    map_unavailable: "This path map is currently unavailable.",
  };

  return NextResponse.json({ ...result, message: messages[result.status] ?? "Unable to check this score." });
}
