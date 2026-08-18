import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getGuildMemberById } from "@/lib/discord";
import { syncUserTagsFromDiscord } from "@/lib/discord-sync";

export const dynamic = "force-dynamic";

export async function POST() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token || !guildId) {
    return NextResponse.json(
      { error: "Discord bot not configured" },
      { status: 500 }
    );
  }

  const member = sessionUser.discordId
    ? await getGuildMemberById(token, guildId, sessionUser.discordId)
    : null;
  const inGuild = member !== null;
  const roleIds = member?.roles ?? [];

  await prisma.user.update({
    where: { id: sessionUser.id },
    data: { discordRoles: roleIds, inGuild },
  });

  const result = await syncUserTagsFromDiscord(prisma, sessionUser.id, roleIds);

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    include: {
      userTags: { include: { tag: true } },
    },
  });

  return NextResponse.json({
    success: true,
    inGuild,
    tagsApplied: result.applied,
    tagsRemoved: result.removed,
    user,
  });
}
