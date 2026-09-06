import { prisma } from "@/lib/db";
import { ensureChallengeLevelTable, ensureChallengeVisibilityTable } from "@/lib/challenge";
import { getSessionUser, isOwner } from "@/lib/auth";
import { ChallengeMapLevelManager } from "@/components/admin/challenge-map-level-manager";
import { ChallengeCategoryManager } from "@/components/admin/challenge-category-manager";

export const dynamic = "force-dynamic";

export default async function AdminChallengePage() {
  await Promise.all([ensureChallengeLevelTable(), ensureChallengeVisibilityTable()]);
  const user = await getSessionUser();
  const maps = await prisma.$queryRawUnsafe<Array<{ id: string; title: string; artist: string | null; mapFileUrl: string; rating: number | null; status: string; level: number | null; visible: boolean }>>(`SELECT m."id",m."title",m."artist",m."mapFileUrl",m."rating",m."status"::text AS "status",l."level",COALESCE(v."visible",true) AS "visible" FROM "ChallengeMap" m LEFT JOIN "ChallengeMapLevel" l ON l."challengeMapId"=m."id" LEFT JOIN "ChallengeMapVisibility" v ON v."challengeMapId"=m."id" ORDER BY m."status" ASC,m."createdAt" DESC`);
  const owner = Boolean(user && isOwner(user));
  return <div className="space-y-6"><section className="ui-card rounded-3xl p-8"><p className="text-sm uppercase tracking-[0.3em] text-accent">Challenge</p><h1 className="mt-2 text-3xl font-semibold text-white">Challenge and category management</h1><p className="mt-3 text-sm leading-7 text-muted">Assign Levels 1-10 and control public visibility independently so multiple Challenge maps can be active at the same time.</p></section><ChallengeCategoryManager isOwner={owner} /><section><h2 className="mb-4 text-xl font-semibold text-white">Challenge level assignments</h2><ChallengeMapLevelManager initialMaps={maps} /></section></div>;
}
