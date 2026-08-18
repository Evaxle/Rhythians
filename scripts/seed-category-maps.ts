import "dotenv/config";
import { fetchRankedMaps } from "../lib/daily";
import { CATEGORIES, CATEGORY_LABELS, MAX_CATEGORY_LEVEL, type Category } from "../lib/categories";
import { prisma } from "../lib/db";

const SYSTEM_USER_HANDLE = "rhythia-imports";
const SYSTEM_USER_NAME = "Rhythia";

async function getSystemUser() {
  const existing = await prisma.user.findUnique({ where: { profileHandle: SYSTEM_USER_HANDLE } });
  if (existing) return existing;
  return prisma.user.create({
    data: {
      username: SYSTEM_USER_NAME,
      discriminator: "0000",
      profileHandle: SYSTEM_USER_HANDLE,
      displayName: "Rhythia (auto-import)",
    },
  });
}

// Assigns ranked Rhythia maps to categories and levels round-robin so each
// category/level gets a spread of maps. Real maps can be curated later via the
// admin panel.
async function main() {
  const systemUser = await getSystemUser();

  console.log("Fetching ranked maps from Rhythia...");
  const maps = await fetchRankedMaps();
  console.log(`Fetched ${maps.length} ranked maps.`);

  const slots: Array<{ category: Category; level: number }> = [];
  for (const category of CATEGORIES) {
    for (let level = 1; level <= MAX_CATEGORY_LEVEL; level++) {
      slots.push({ category, level });
    }
  }

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < maps.length; i++) {
    const map = maps[i];
    const slot = slots[i % slots.length];
    try {
      const dash = map.title.indexOf(" - ");
      const artist = dash > 0 ? map.title.slice(0, dash).trim() : null;
      await prisma.categoryMap.create({
        data: {
          category: slot.category,
          level: slot.level,
          title: map.title,
          artist,
          mapFileUrl: map.downloadUrl ?? "",
          imageUrl: map.imageUrl,
          mapperName: map.ownerUsername,
          noteCount: map.noteCount,
          length: map.length,
          sourceBeatmapId: map.id,
          sourceUrl: `https://www.rhythia.com/maps/${map.id}`,
          submittedById: systemUser.id,
          status: "approved",
          reviewedById: systemUser.id,
          reviewedAt: new Date(),
        },
      });
      created += 1;
    } catch (error: any) {
      if (error?.code === "P2002") {
        skipped += 1;
      } else {
        errors += 1;
        console.error(`Failed to import [${map.id}] ${map.title}:`, error.message);
      }
    }
  }

  console.log(`\nDone. Created: ${created}, already present: ${skipped}, errors: ${errors}`);

  for (const category of CATEGORIES) {
    const count = await prisma.categoryMap.count({ where: { category, status: "approved" } });
    console.log(`  ${CATEGORY_LABELS[category]}: ${count} approved maps`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
