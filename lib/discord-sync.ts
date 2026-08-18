import type { PrismaClient } from "../generated/prisma/client";
import { ROLE_TO_TAG_MAP, getAllGuildMembers } from "./discord";

export async function resolveDiscordRolesToTagIds(
  prisma: PrismaClient,
  roleIds: string[]
): Promise<Set<string>> {
  const tagIds = new Set<string>();

  if (roleIds.length === 0) return tagIds;

  const direct = await prisma.discordRoleTagMapping.findMany({
    where: { discordRoleId: { in: roleIds } },
    select: { discordRoleId: true, tagId: true },
  });
  for (const mapping of direct) tagIds.add(mapping.tagId);

  const legacyMappings = await prisma.discordRoleMapping.findMany({
    where: { discordRoleId: { in: roleIds } },
    include: { role: true },
  });
  const slugs: string[] = [];
  for (const mapping of legacyMappings) {
    const tagSlug = ROLE_TO_TAG_MAP[mapping.role.name.toLowerCase()];
    if (tagSlug && !slugs.includes(tagSlug)) slugs.push(tagSlug);
  }
  if (slugs.length > 0) {
    const tags = await prisma.tag.findMany({
      where: { slug: { in: slugs } },
      select: { id: true },
    });
    for (const tag of tags) tagIds.add(tag.id);
  }

  return tagIds;
}

export async function syncUserTagsFromDiscord(
  prisma: PrismaClient,
  userId: string,
  roleIds: string[]
): Promise<{ applied: number; removed: number }> {
  const desired = await resolveDiscordRolesToTagIds(prisma, roleIds);
  const existing = await prisma.userTag.findMany({
    where: { userId },
    select: { id: true, tagId: true, source: true },
  });

  const existingByTag = new Map(existing.map((entry) => [entry.tagId, entry]));

  const toRemove = existing.filter(
    (entry) => entry.source === "discord" && !desired.has(entry.tagId)
  );
  if (toRemove.length > 0) {
    await prisma.userTag.deleteMany({
      where: { id: { in: toRemove.map((entry) => entry.id) } },
    });
  }

  let applied = 0;
  for (const tagId of desired) {
    const existingRow = existingByTag.get(tagId);
    if (existingRow) {
      if (existingRow.source !== "discord") {
        await prisma.userTag.update({
          where: { id: existingRow.id },
          data: { source: "discord" },
        });
      }
    } else {
      await prisma.userTag.create({
        data: { userId, tagId, source: "discord" },
      });
    }
    applied++;
  }

  return { applied, removed: toRemove.length };
}

export async function syncUserFromDiscordRoles(
  prisma: PrismaClient,
  discordUserId: string,
  roleIds: string[],
  inGuild: boolean
): Promise<{ found: boolean; applied: number; removed: number } | null> {
  const user = await prisma.user.findUnique({ where: { discordId: discordUserId } });
  if (!user) return null;

  await prisma.user.update({
    where: { id: user.id },
    data: { discordRoles: roleIds, inGuild },
  });

  const result = await syncUserTagsFromDiscord(prisma, user.id, roleIds);
  return { found: true, ...result };
}

export async function markUserLeftGuild(prisma: PrismaClient, discordUserId: string) {
  const user = await prisma.user.findUnique({ where: { discordId: discordUserId } });
  if (!user) return null;

  await prisma.user.update({
    where: { id: user.id },
    data: { inGuild: false, discordRoles: [] },
  });
  await prisma.userTag.deleteMany({ where: { userId: user.id, source: "discord" } });

  return user;
}

export async function syncAllGuildMembers(
  prisma: PrismaClient,
  token: string,
  guildId: string
) {
  const members = await getAllGuildMembers(token, guildId);

  const memberIds = new Set<string>();
  let applied = 0;
  let removed = 0;
  let found = 0;

  for (const member of members) {
    const discordUserId = member.user?.id;
    if (!discordUserId) continue;
    memberIds.add(discordUserId);
    const roleIds = member.roles ?? [];
    const result = await syncUserFromDiscordRoles(prisma, discordUserId, roleIds, true);
    if (result) {
      found++;
      applied += result.applied;
      removed += result.removed;
    }
  }

  const guildMembers = await prisma.user.findMany({ where: { inGuild: true } });
  let markedLeft = 0;
  for (const user of guildMembers) {
    if (user.discordId && !memberIds.has(user.discordId)) {
      await markUserLeftGuild(prisma, user.discordId);
      markedLeft++;
    }
  }

  return {
    totalMembers: members.length,
    matchedUsers: found,
    tagsApplied: applied,
    tagsRemoved: removed,
    markedLeft,
  };
}
