import "dotenv/config";
import { prisma } from "../lib/db";
import { rankIndexForRating, rhpGainForMap } from "../lib/ranks";

// Recalculates the stored RHP points for every completion on every approved
// map using the current RHP formula (rank base x difficulty factor x accuracy).
// Run this after changing the RHP system so all approved maps on the site show
// consistent points. Speed modifiers are not stored on completions, so the
// recalculated value uses the base speed (no modifier bonus).
async function main() {
  const maps = await prisma.challengeMap.findMany({
    where: { status: "approved", rating: { not: null } },
    select: { id: true, title: true, rating: true },
  });

  let updated = 0;
  let unchanged = 0;

  for (const map of maps) {
    const rating = map.rating as number;
    const rankIndex = rankIndexForRating(rating);
    const completions = await prisma.challengeMapCompletion.findMany({
      where: { challengeMapId: map.id },
      select: { id: true, accuracy: true, points: true },
    });

    for (const completion of completions) {
      const newPoints = rhpGainForMap(rating, completion.accuracy, null, rankIndex);
      if (newPoints === completion.points) {
        unchanged += 1;
        continue;
      }
      await prisma.challengeMapCompletion.update({
        where: { id: completion.id },
        data: { points: newPoints },
      });
      updated += 1;
    }
  }

  console.log(`Recalculated ${updated} completion(s) across ${maps.length} approved map(s). ${unchanged} already matched.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
