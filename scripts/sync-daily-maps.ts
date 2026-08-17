import "dotenv/config";
import { getRankedMapsCached, getOrCreateDailyMap, startOfMonthUTC } from "../lib/daily";
import { RANKS } from "../lib/ranks";
import { prisma } from "../lib/db";

async function main() {
  console.log("Syncing ranked map snapshot...");
  const maps = await getRankedMapsCached();
  console.log(`Cached ${maps.length} ranked maps.`);

  const monthStart = startOfMonthUTC();
  const used = await prisma.dailyMap.count({ where: { date: { gte: monthStart } } });
  console.log(`Daily maps already picked this month: ${used}`);

  for (const rank of RANKS) {
    const today = await getOrCreateDailyMap(rank.index);
    console.log(`[${rank.name}] Today: ${today.title} (${today.starRating.toFixed(2)} stars)`);

    const tomorrow = new Date(Date.UTC(today.date.getUTCFullYear(), today.date.getUTCMonth(), today.date.getUTCDate() + 1));
    const tomorrowMap = await getOrCreateDailyMap(rank.index, tomorrow);
    console.log(`[${rank.name}] Tomorrow: ${tomorrowMap.title} (${tomorrowMap.starRating.toFixed(2)} stars)`);
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