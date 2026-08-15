import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getGuildInfo, getGuildRoles } from "../lib/discord";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL!, ssl: { rejectUnauthorized: false } });
const prisma = new PrismaClient({ adapter });

async function main() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token || !guildId) {
    console.error("Missing DISCORD_BOT_TOKEN or DISCORD_GUILD_ID");
    process.exit(1);
  }

  const guild = await getGuildInfo(token, guildId);
  const roles = await getGuildRoles(token, guildId);
  const [tags, mappings] = await Promise.all([
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
    prisma.discordRoleTagMapping.findMany({ include: { tag: true } }),
  ]);

  console.log("=".repeat(70));
  console.log(`GUILD: ${guild?.name ?? "unknown"} (${guildId})`);
  console.log("=".repeat(70));

  const mappingByRoleId = new Map(mappings.map((m) => [m.discordRoleId, m.tag]));

  console.log("\nDISCORD ROLES:");
  console.log("-".repeat(70));
  const sorted = [...roles].sort((a, b) => b.position - a.position);
  for (const role of sorted) {
    if (role.name === "@everyone") continue;
    const mapped = mappingByRoleId.get(role.id);
    const flag = mapped ? `-> ${mapped.slug}` : "(no mapping)";
    console.log(`  ${role.name} [${role.id}] ${flag}`);
  }

  console.log("\nWEBSITE TAGS:");
  console.log("-".repeat(70));
  const mappedTagIds = new Set(mappings.map((m) => m.tagId));
  for (const tag of tags) {
    const mapped = mappedTagIds.has(tag.id);
    console.log(`  ${tag.slug} ${mapped ? "(mapped)" : "(no role maps to this)"}`);
  }

  console.log("\nTAGS WITHOUT A DISCORD ROLE MATCH:");
  console.log("-".repeat(70));
  const roleNameById = new Map(roles.map((r) => [r.id, r.name]));
  for (const tag of tags) {
    if (mappedTagIds.has(tag.id)) continue;
    console.log(`  ${tag.slug}`);
  }
  console.log("-".repeat(70));
  console.log("Note: role IDs shown above are what the DiscordRoleTagMapping table uses.");
}

main()
  .catch((error) => { console.error(error); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
