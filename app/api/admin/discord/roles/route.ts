import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { getGuildInfo, getGuildRoles } from "@/lib/discord";

export const dynamic = "force-dynamic";

export async function GET() {
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
      { error: "Discord bot not configured" },
      { status: 500 }
    );
  }

  const [guild, roles, mappings, tags] = await Promise.all([
    getGuildInfo(token, guildId),
    getGuildRoles(token, guildId),
    prisma.discordRoleTagMapping.findMany({ include: { tag: true } }),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
  ]);

  const mappingByRoleId = new Map(
    mappings.map((mapping) => [mapping.discordRoleId, mapping])
  );

  const rolesWithMappings = roles
    .filter((role) => role.name !== "@everyone")
    .sort((a, b) => b.position - a.position)
    .map((role) => ({
      id: role.id,
      name: role.name,
      color: role.color,
      position: role.position,
      managed: role.managed,
      mappedTagId: mappingByRoleId.get(role.id)?.tagId ?? null,
    }));

  return NextResponse.json({
    guild: guild
      ? {
          id: guild.id,
          name: guild.name,
          icon: guild.icon,
          memberCount: guild.approximate_member_count ?? guild.member_count ?? 0,
        }
      : null,
    roles: rolesWithMappings,
    tags: tags.map((tag) => ({ id: tag.id, name: tag.name, slug: tag.slug })),
  });
}
