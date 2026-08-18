import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRhythiaRpGains } from "@/lib/maps";
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

// Daily cron: re-weights every linked user's RHP credit from their current
// Rhythia RP. Each user is gated to once per 24 hours inside checkRhythiaRpGains,
// so this only actually fetches from Rhythia for users who are due.
export async function GET(request: Request) {
  const rate = checkRateLimit(request, "internal_rhythia_rp_check", 5, 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const users = await prisma.user.findMany({
    where: {
      rhythiaProfile: { isNot: null },
      OR: [{ lastRhythiaRpCheckAt: null }, { lastRhythiaRpCheckAt: { lt: cutoff } }],
    },
    select: { id: true },
  });

  let checked = 0;
  let awarded = 0;
  const CHUNK = 5;
  for (let i = 0; i < users.length; i += CHUNK) {
    const chunk = users.slice(i, i + CHUNK);
    const results = await Promise.all(
      chunk.map(async (user) => {
        try {
          return await checkRhythiaRpGains(user.id);
        } catch {
          return { checked: false, awarded: 0, currentRp: null, target: 0, credited: 0 };
        }
      })
    );
    for (const result of results) {
      if (result.checked) checked += 1;
      awarded += result.awarded;
    }
  }

  return NextResponse.json({ success: true, due: users.length, checked, awarded });
}
