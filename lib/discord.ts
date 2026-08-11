import { prisma } from "@/lib/db";

export async function fetchDiscordGuildMember(discordToken: string, guildId: string, userId: string) {
  const response = await fetch(`https://discord.com/api/guilds/${guildId}/members/${userId}`, {
    headers: { Authorization: `Bot ${discordToken}` },
  });
  if (!response.ok) return null;
  return response.json();
}

export async function syncDiscordRoles(userId: string, discordRoleIds: string[]) {
  const mappings = await prisma.discordRoleMapping.findMany({
    where: { discordRoleId: { in: discordRoleIds } },
    include: { role: true },
  });
  return mappings.map((mapping) => mapping.role.name);
}
