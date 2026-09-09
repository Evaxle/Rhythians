import { prisma } from "@/lib/db";
import { getCurrentRbpSeason } from "@/lib/rbp";
import { battleSeedForRhp } from "@/lib/ranking-system";
import { getRankInfo } from "@/lib/ranks";

export async function placeBattleRanks(userIds?: string[], replace = false) {
  const season = await getCurrentRbpSeason();
  if (!season) return { season: null, changed: 0 };
  const ids = userIds?.filter(Boolean) ?? [];
  const users = await prisma.user.findMany({ where: { profileHandle: { not: "rhythia-imports" }, ...(ids.length ? { id: { in: ids } } : {}) }, select: { id: true, rhp: true } });
  let changed = 0;
  await prisma.$transaction(async tx => {
    for (const user of users) {
      const rbp = battleSeedForRhp(user.rhp);
      const placementRankIndex = getRankInfo(rbp).index;
      const rows = await tx.$queryRawUnsafe<Array<{ userId: string }>>('INSERT INTO "RbpUserSeason" (id,"seasonId","userId","placementRankIndex",rbp,"createdAt","updatedAt") VALUES (gen_random_uuid(),$1,$2,$3,$4,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT ("seasonId","userId") DO UPDATE SET "placementRankIndex"=EXCLUDED."placementRankIndex",rbp=EXCLUDED.rbp,"updatedAt"=CURRENT_TIMESTAMP WHERE $5::boolean RETURNING "userId"', season.id, user.id, placementRankIndex, rbp, replace);
      changed += rows.length;
    }
  });
  return { season, changed };
}

export async function placeLinkedUserInBattleRank(userId: string) { return placeBattleRanks([userId], false); }
