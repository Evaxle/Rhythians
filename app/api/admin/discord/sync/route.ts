import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { syncAllGuildMembers } from "@/lib/discord-sync";
import { checkRateLimit } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rate = checkRateLimit(request, "admin_sync", 30, 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  try {
    const sessionUser = await getSessionUser();

    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await canAccessAdmin(sessionUser))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const token = process.env.DISCORD_BOT_TOKEN;
    const guildId = process.env.DISCORD_GUILD_ID;

    if (!token || !guildId) {
      return NextResponse.json(
        { error: "Discord bot not configured. Set DISCORD_BOT_TOKEN and DISCORD_GUILD_ID in the server environment." },
        { status: 500 }
      );
    }

    const result = await syncAllGuildMembers(prisma, token, guildId);

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Discord admin sync failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to check Discord server status.",
      },
      { status: 502 }
    );
  }
}
