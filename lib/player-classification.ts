import type { PrismaClient } from "../generated/prisma/client";
import { rhythiaRequest } from "@/lib/rhythia";

const AUTOMATIC_RANKS = [
  { name: "Beginner", slug: "beginner", displayOrder: 1, color: "#60a5fa" },
  { name: "Intermediate", slug: "intermediate", displayOrder: 2, color: "#4ade80" },
  { name: "Experienced", slug: "experienced", displayOrder: 3, color: "#facc15" },
  { name: "Expert", slug: "expert", displayOrder: 4, color: "#f87171" },
] as const;

const AUTOMATIC_RANK_TAG_SLUGS = AUTOMATIC_RANKS.map((rank) => rank.slug);
const AUTOMATIC_ACCOUNT_TAG_SLUGS = ["veteran", "mentor"] as const;
const ACCOUNT_DATE_KEYS = ["created_at", "createdAt", "registered_at", "registeredAt", "joined_at", "joinedAt", "registration_date", "registrationDate"] as const;

type ClassificationClient = Pick<PrismaClient, "playerRank" | "user" | "tag" | "userTag">;

export function classificationForGlobalRank(globalRank: number | null | undefined) {
  if (!globalRank || globalRank < 1) return null;
  if (globalRank <= 500) return "expert";
  if (globalRank <= 1000) return "experienced";
  if (globalRank <= 5000) return "intermediate";
  return "beginner";
}

function parseDateValue(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateFromRecord(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of ACCOUNT_DATE_KEYS) {
    const parsed = parseDateValue(record[key]);
    if (parsed) return parsed;
  }
  return null;
}

function findAccountCreatedAt(profile: Record<string, unknown>) {
  const userDate = dateFromRecord(profile.user);
  if (userDate) return userDate;
  const accountDate = dateFromRecord(profile.account);
  if (accountDate) return accountDate;
  const profileDate = dateFromRecord(profile.profile);
  if (profileDate) return profileDate;
  return dateFromRecord(profile);
}

export async function fetchRhythiaAccountCreatedAt(profileId: number) {
  const profile = await rhythiaRequest<Record<string, unknown>>("getProfile", { id: profileId });
  return findAccountCreatedAt(profile);
}

export function accountTagsForCreatedAt(accountCreatedAt: Date | null | undefined) {
  if (!accountCreatedAt) return [] as string[];
  const year = accountCreatedAt.getUTCFullYear();
  const tags: string[] = [];
  if (year === 2024) tags.push("veteran");
  if (year === 2024 || year === 2025) tags.push("mentor");
  return tags;
}

export async function syncAutomaticPlayerClassification(
  client: ClassificationClient,
  userId: string,
  globalRank: number | null | undefined,
  accountCreatedAt: Date | null | undefined
) {
  const classification = classificationForGlobalRank(globalRank);

  for (const rank of AUTOMATIC_RANKS) {
    await client.playerRank.upsert({
      where: { slug: rank.slug },
      update: { name: rank.name, displayOrder: rank.displayOrder, color: rank.color, enabled: true },
      create: rank,
    });
  }

  const playerRank = classification
    ? await client.playerRank.findUnique({ where: { slug: classification }, select: { id: true } })
    : null;

  await client.user.update({
    where: { id: userId },
    data: { playerRankId: playerRank?.id ?? null, onboardingCompleted: true },
  });

  const oldRankTags = await client.tag.findMany({
    where: { slug: { in: [...AUTOMATIC_RANK_TAG_SLUGS] } },
    select: { id: true },
  });

  if (oldRankTags.length) {
    await client.userTag.deleteMany({
      where: { userId, tagId: { in: oldRankTags.map((tag) => tag.id) } },
    });
  }

  if (!accountCreatedAt) return { classification, accountTags: null };

  const desiredAccountTags = accountTagsForCreatedAt(accountCreatedAt);
  const accountTags = await Promise.all(
    AUTOMATIC_ACCOUNT_TAG_SLUGS.map((slug) =>
      client.tag.upsert({
        where: { slug },
        update: {},
        create: { slug, name: slug.charAt(0).toUpperCase() + slug.slice(1) },
        select: { id: true, slug: true },
      })
    )
  );

  const unwantedTagIds = accountTags.filter((tag) => !desiredAccountTags.includes(tag.slug)).map((tag) => tag.id);
  if (unwantedTagIds.length) {
    await client.userTag.deleteMany({ where: { userId, tagId: { in: unwantedTagIds } } });
  }

  for (const tag of accountTags) {
    if (!desiredAccountTags.includes(tag.slug)) continue;
    await client.userTag.upsert({
      where: { userId_tagId: { userId, tagId: tag.id } },
      update: { source: "manual" },
      create: { userId, tagId: tag.id, source: "manual" },
    });
  }

  return { classification, accountTags: desiredAccountTags };
}
