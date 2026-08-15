import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncAllGuildMembers } from "@/lib/discord-sync";
import { checkRateLimit } from "@/lib/security";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const url = new URL(request.url);
    const provided =
      url.searchParams.get("secret") ?? request.headers.get("x-cron-secret");
    return provided === secret;
  }
  return request.headers.get("x-vercel-cron") === "1";
}

export async function GET(request: Request) {
  const rate = checkRateLimit(request, "internal_sync", 5, 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token || !guildId) {
    return NextResponse.json(
      { error: "Discord bot not configured" },
      { status: 500 }
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncAllGuildMembers(prisma, token, guildId);

  return NextResponse.json({ success: true, ...result });
}
