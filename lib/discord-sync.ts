import type { PrismaClient } from "../generated/prisma/client";
import { ROLE_TO_TAG_MAP, DiscordApiError, getGuildMemberById, validateDiscordBot } from "./discord";

const SYNC_DELAY_MS = 250;

export async function resolveDiscordRolesToTagIds(prisma: PrismaClient, roleIds: string[]): Promise<Set<string>> {
  const tagIds = new Set<string>();
  if (roleIds.length === 0) return tagIds;

  const direct = await prisma.discordRoleTagMapping.findMany({
    where: { discordRoleId: { in: roleIds } },
    select: { tagId: true },
  });
  for (const mapping of direct) tagIds.add(mapping.tagId);

  const legacyMappings = await prisma.discordRoleMapping.findMany({
    where: { discordRoleId: { in: roleIds } },
    include: { role: true },
  });
  const slugs: string[] = [];
  for (const mapping of legacyMappings) {
    const slug = ROLE_TO_TAG_MAP[mapping.role.name.toLowerCase()];
    if (slug && !slugs.includes(slug)) slugs.push(slug);
  }
  if (slugs.length) {
    const tags = await prisma.tag.findMany({ where: { slug: { in: slugs } }, select: { id: true } });
    for (const tag of tags) tagIds.add(tag.id);
  }
  return tagIds;
}

export async function syncUserTagsFromDiscord(prisma: PrismaClient, userId: string, roleIds: string[]) {
  const desired = await resolveDiscordRolesToTagIds(prisma, roleIds);
  const existing = await prisma.userTag.findMany({
    where: { userId },
    select: { id: true, tagId: true, source: true },
  });
  const existingByTag = new Map(existing.map((entry) => [entry.tagId, entry]));
  const toRemove = existing.filter((entry) => entry.source === "discord" && !desired.has(entry.tagId));
  if (toRemove.length) {
    await prisma.userTag.deleteMany({ where: { id: { in: toRemove.map((entry) => entry.id) } } });
  }

  let applied = 0;
  for (const tagId of desired) {
    if (!existingByTag.has(tagId)) {
      await prisma.userTag.create({ data: { userId, tagId, source: "discord" } });
      applied++;
    }
  }
  return { applied, removed: toRemove.length };
}

export async function syncUserFromDiscordRoles(prisma: PrismaClient, discordUserId: string, roleIds: string[], inGuild: boolean) {
  const user = await prisma.user.findUnique({ where: { discordId: discordUserId } });
  if (!user) return null;
  await prisma.user.update({ where: { id: user.id }, data: { discordRoles: roleIds, inGuild } });
  const result = await syncUserTagsFromDiscord(prisma, user.id, roleIds);
  return { found: true, ...result };
}

export async function markUserLeftGuild(prisma: PrismaClient, discordUserId: string) {
  const user = await prisma.user.findUnique({ where: { discordId: discordUserId } });
  if (!user) return null;
  await prisma.user.update({ where: { id: user.id }, data: { inGuild: false, discordRoles: [] } });
  await prisma.userTag.deleteMany({ where: { userId: user.id, source: "discord" } });
  return user;
}

export async function syncAllGuildMembers(prisma: PrismaClient, token: string, guildId: string) {
  await validateDiscordBot(token, guildId);

  const users = await prisma.user.findMany({
    where: { discordId: { not: null } },
    select: { discordId: true },
  });

  let tagsApplied = 0;
  let tagsRemoved = 0;
  let matchedUsers = 0;
  let checkedUsers = 0;
  let markedLeft = 0;

  for (const user of users) {
    if (!user.discordId) continue;
    checkedUsers++;

    const member = await getGuildMemberById(token, guildId, user.discordId);
    const result = await syncUserFromDiscordRoles(prisma, user.discordId, member?.roles ?? [], member !== null);
    if (!result) continue;

    if (member) {
      matchedUsers++;
      tagsApplied += result.applied;
      tagsRemoved += result.removed;
    } else {
      markedLeft++;
      tagsRemoved += result.removed;
    }

    await new Promise((resolve) => setTimeout(resolve, SYNC_DELAY_MS));
  }

  return { totalMembers: matchedUsers, checkedUsers, matchedUsers, tagsApplied, tagsRemoved, markedLeft };
}
