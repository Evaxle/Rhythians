import { prisma } from "@/lib/db";
import { getCurrentRbpSeason } from "@/lib/rbp";

export async function placeBattleRanks(userIds?: string[], replace = false) {
  const season = await getCurrentRbpSeason();
  if (!season) return { season: null, changed: 0 };
  const ids = userIds?.filter(Boolean) ?? [];
  const filter = ids.length ? 'AND u.id = ANY($3::text[])' : '';
  const params: unknown[] = [season.id, replace];
  if (ids.length) params.push(ids);
  const rows = await prisma.$queryRawUnsafe<Array<{ userId: string }>>(
    `INSERT INTO "RbpUserSeason" ("id","seasonId","userId","placementRankIndex","rbp","createdAt","updatedAt")
     SELECT gen_random_uuid(),$1,u.id,
       GREATEST(0,LEAST(8,FLOOR(GREATEST(0,u.rhp)::numeric/500)::integer)-1),
       GREATEST(0,LEAST(8,FLOOR(GREATEST(0,u.rhp)::numeric/500)::integer)-1)*500,
       CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
     FROM "User" u
     WHERE u."profileHandle" <> 'rhythia-imports' ${filter}
     ON CONFLICT ("seasonId","userId") DO UPDATE SET
       "placementRankIndex"=EXCLUDED."placementRankIndex","rbp"=EXCLUDED."rbp","updatedAt"=CURRENT_TIMESTAMP
     WHERE $2::boolean
     RETURNING "userId"`,
    ...params,
  );
  return { season, changed: rows.length };
}

export async function placeLinkedUserInBattleRank(userId: string) {
  return placeBattleRanks([userId], false);
}
