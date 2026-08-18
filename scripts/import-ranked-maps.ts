import "dotenv/config";
import { fetchRankedMaps } from "../lib/daily";
import { submitChallengeMap } from "../lib/maps";
import { fairRatingFromStars } from "../lib/ranks";
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

async function main() {
  const systemUser = await getSystemUser();

  console.log("Fetching ranked maps from Rhythia...");
  const maps = await fetchRankedMaps();
  console.log(`Fetched ${maps.length} ranked maps.`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const map of maps) {
    try {
      const rating = fairRatingFromStars(map.starRating ?? 0);
      const created = await submitChallengeMap({
        title: map.title,
        artist: map.title.includes(" - ") ? map.title.split(" - ")[0].trim() : null,
        description: null,
        mapFileUrl: map.downloadUrl ?? "",
        imageUrl: map.imageUrl,
        requestedRating: rating,
        mapperName: map.ownerUsername,
        noteCount: map.noteCount,
        length: map.length,
        submittedById: systemUser.id,
        sourceBeatmapId: map.id,
        sourceUrl: `https://www.rhythia.com/maps/${map.id}`,
        isAutoImported: true,
      });
      // Auto-imports go straight to approved with a fair rating.
      await prisma.challengeMap.update({
        where: { id: created.id },
        data: { status: "approved", rating, reviewedAt: new Date() },
      });
      imported += 1;
    } catch (error: any) {
      // Unique sourceBeatmapId constraint means it was already imported.
      if (error?.code === "P2002") {
        skipped += 1;
      } else {
        errors += 1;
        console.error(`Failed to import [${map.id}] ${map.title}:`, error.message);
      }
    }
  }

  console.log(`\nDone. Imported: ${imported}, already present: ${skipped}, errors: ${errors}`);

  const total = await prisma.challengeMap.count({ where: { status: "approved" } });
  console.log(`Total approved challenge maps now: ${total}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });