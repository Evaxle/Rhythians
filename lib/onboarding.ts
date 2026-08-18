import type { PrismaClient } from "../generated/prisma/client";

const DISCORD_API_BASE = "https://discord.com/api/v10";
const ONBOARDING_CACHE_KEY = "discord_onboarding";
const CACHE_TTL_MS = 60 * 60 * 1000;

export interface OnboardingOption {
  id: string;
  title: string;
  description: string | null;
  roleIds: string[];
  emojiName: string | null;
}

export interface OnboardingPrompt {
  id: string;
  title: string;
  singleSelect: boolean;
  required: boolean;
  options: OnboardingOption[];
}

export interface OnboardingData {
  prompts: OnboardingPrompt[];
}

interface CachedOnboarding {
  fetchedAt: string;
  data: OnboardingData;
}

async function fetchFromDiscord(): Promise<OnboardingData> {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!token || !guildId) return { prompts: [] };

  try {
    const response = await fetch(`${DISCORD_API_BASE}/guilds/${guildId}/onboarding`, {
      headers: { Authorization: `Bot ${token}` },
    });
    if (!response.ok) return { prompts: [] };
    const data = await response.json();

    const prompts: OnboardingPrompt[] = (data.prompts ?? [])
      .filter((prompt: any) => prompt.title && Array.isArray(prompt.options))
      .map((prompt: any) => ({
        id: prompt.id,
        title: prompt.title,
        singleSelect: prompt.single_select !== false,
        required: prompt.required ?? false,
        options: prompt.options
          .filter((option: any) => option.title)
          .map((option: any) => ({
            id: option.id,
            title: option.title,
            description: option.description ?? null,
            roleIds: Array.isArray(option.role_ids) ? option.role_ids : [],
            emojiName: option.emoji?.name ?? null,
          })),
      }));

    return { prompts };
  } catch (error) {
    console.error("Failed to fetch Discord onboarding:", error);
    return { prompts: [] };
  }
}

export async function getOnboardingData(
  prisma: PrismaClient,
  force = false
): Promise<OnboardingData> {
  const cached = await prisma.siteSetting.findUnique({
    where: { key: ONBOARDING_CACHE_KEY },
  });

  if (!force && cached?.value) {
    try {
      const parsed = JSON.parse(cached.value) as CachedOnboarding;
      const fetchedAt = new Date(parsed.fetchedAt).getTime();
      if (Date.now() - fetchedAt < CACHE_TTL_MS) return parsed.data;
    } catch {
      // fall through and refresh
    }
  }

  const data = await fetchFromDiscord();
  if (data.prompts.length > 0) {
    const value: CachedOnboarding = { fetchedAt: new Date().toISOString(), data };
    await prisma.siteSetting.upsert({
      where: { key: ONBOARDING_CACHE_KEY },
      update: { value: JSON.stringify(value) },
      create: { key: ONBOARDING_CACHE_KEY, value: JSON.stringify(value), description: "Cached Discord onboarding prompts" },
    });
  }

  return data;
}

export function getPromptOptions(data: OnboardingData): Map<string, OnboardingOption> {
  const map = new Map<string, OnboardingOption>();
  for (const prompt of data.prompts) {
    for (const option of prompt.options) map.set(option.id, option);
  }
  return map;
}

export async function resolveOptionTagSlugs(
  prisma: PrismaClient,
  option: OnboardingOption
): Promise<string[]> {
  if (option.roleIds.length === 0) return [];

  const mappings = await prisma.discordRoleTagMapping.findMany({
    where: { discordRoleId: { in: option.roleIds } },
    include: { tag: true },
  });

  return mappings.map((mapping) => mapping.tag.slug);
}

export async function getSelectedOptionIds(
  prisma: PrismaClient,
  data: OnboardingData,
  userTagSlugs: Set<string>
): Promise<string[]> {
  const allRoleIds = new Set<string>();
  for (const prompt of data.prompts) {
    for (const option of prompt.options) {
      for (const roleId of option.roleIds) allRoleIds.add(roleId);
    }
  }

  const mappings = allRoleIds.size
    ? await prisma.discordRoleTagMapping.findMany({
        where: { discordRoleId: { in: [...allRoleIds] } },
        select: { discordRoleId: true, tag: { select: { slug: true } } },
      })
    : [];
  const roleTagSlug = new Map(mappings.map((m) => [m.discordRoleId, m.tag.slug]));

  const selected = new Set<string>();
  for (const prompt of data.prompts) {
    for (const option of prompt.options) {
      const allPresent =
        option.roleIds.length > 0 &&
        option.roleIds.every((roleId) => {
          const slug = roleTagSlug.get(roleId);
          return slug ? userTagSlugs.has(slug) : false;
        });
      if (allPresent) selected.add(option.id);
    }
  }

  return [...selected];
}

export async function applyOnboardingAnswers(
  prisma: PrismaClient,
  userId: string,
  optionIds: string[]
): Promise<{ applied: number; tagSlugs: string[] }> {
  const data = await getOnboardingData(prisma);
  const options = getPromptOptions(data);

  const validIds = new Set<string>();
  const roleIds = new Set<string>();
  for (const optionId of optionIds) {
    const option = options.get(optionId);
    if (option) {
      validIds.add(optionId);
      for (const roleId of option.roleIds) roleIds.add(roleId);
    }
  }

  if (validIds.size !== new Set(optionIds).size) {
    throw new Error("One or more selected answers are invalid.");
  }

  const mappings = await prisma.discordRoleTagMapping.findMany({
    where: { discordRoleId: { in: [...roleIds] } },
    select: { tagId: true },
  });
  const tagIds = new Set(mappings.map((mapping) => mapping.tagId));

  await prisma.userTag.deleteMany({ where: { userId, source: "onboarding" } });

  for (const tagId of tagIds) {
    await prisma.userTag.upsert({
      where: { userId_tagId: { userId, tagId } },
      create: { userId, tagId, source: "onboarding" },
      update: { source: "onboarding" },
    });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { onboardingCompleted: true },
  });

  const tags = await prisma.tag.findMany({ where: { id: { in: [...tagIds] } } });
  return { applied: tagIds.size, tagSlugs: tags.map((tag) => tag.slug) };
}
