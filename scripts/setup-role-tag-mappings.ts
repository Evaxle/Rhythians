import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getAllGuildMembers } from "../lib/discord";
import { syncUserFromDiscordRoles } from "../lib/discord-sync";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL!, ssl: { rejectUnauthorized: false } });
const prisma = new PrismaClient({ adapter });

const ROLE_ID_TO_TAG_SLUG: Record<string, string> = {
  "1535373196101161030": "beginner",
  "1535373063540187227": "intermediate",
  "1535372921550274632": "experienced",
  "1535405457429110792": "expert",
  "1535373436455493782": "content-creator",
  "1535372824145957017": "veteran",
  "1535368303118123109": "rhythian-coach",
  "1537683271247335434": "tester",
  "1538039433448788069": "post-reviewer",
};

async function main() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!token || !guildId) {
    console.error("Missing DISCORD_BOT_TOKEN or DISCORD_GUILD_ID");
    process.exit(1);
  }

  const slugs = Object.values(ROLE_ID_TO_TAG_SLUG);
  const tags = await prisma.tag.findMany({ where: { slug: { in: slugs } } });
  const tagBySlug = new Map(tags.map((tag) => [tag.slug, tag]));
  const missing = slugs.filter((slug) => !tagBySlug.has(slug));
  if (missing.length > 0) {
    console.error("Missing tags in DB:", missing);
    process.exit(1);
  }

  for (const [discordRoleId, slug] of Object.entries(ROLE_ID_TO_TAG_SLUG)) {
    const tag = tagBySlug.get(slug)!;
    await prisma.discordRoleTagMapping.upsert({
      where: { discordRoleId },
      update: { tagId: tag.id },
      create: { discordRoleId, tagId: tag.id },
    });
    console.log(`mapped ${discordRoleId} -> ${slug}`);
  }

  const members = await getAllGuildMembers(token, guildId);
  let synced = 0;
  for (const member of members) {
    const discordUserId = member.user?.id;
    if (!discordUserId) continue;
    const result = await syncUserFromDiscordRoles(prisma, discordUserId, member.roles ?? [], true);
    if (result) synced++;
  }
  console.log(`\nFull sync done: ${synced} website accounts matched and updated out of ${members.length} members.`);
}

main()
  .catch((error) => { console.error(error); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
