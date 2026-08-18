import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL!, ssl: { rejectUnauthorized: false } });
const prisma = new PrismaClient({ adapter });

const NEW_TAGS: Array<{ name: string; slug: string }> = [
  { name: "Mapper", slug: "mapper" },
  { name: "Developer", slug: "developer" },
  { name: "Owner", slug: "owner" },
];

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
  "1535406421133238312": "mentor",
  "1536251044416454696": "camera-lock",
  "1536251100993294379": "camera-spin",
  "1537198867466944512": "camera-vr",
  "1538972621767446668": "map-reviewer",
  "1535372618985640028": "admin",
  "1535373313738539008": "mapper",
  "1538962192437878954": "developer",
  "1535408705569427577": "owner",
};

async function main() {
  for (const t of NEW_TAGS) {
    await prisma.tag.upsert({
      where: { slug: t.slug },
      update: { name: t.name },
      create: { name: t.name, slug: t.slug },
    });
    console.log(`ensured tag: ${t.slug}`);
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

  console.log("\nDone. All role->tag mappings are up to date.");
}

main()
  .catch((error) => { console.error(error); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });