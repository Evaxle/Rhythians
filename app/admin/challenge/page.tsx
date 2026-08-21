import { prisma } from "@/lib/db";
import { ensureChallengeLevelTable } from "@/lib/challenge";
import { getSessionUser, isOwner } from "@/lib/auth";
import { ChallengeMapLevelManager } from "@/components/admin/challenge-map-level-manager";
import { ChallengeCategoryManager } from "@/components/admin/challenge-category-manager";

export const dynamic = "force-dynamic";

export default async function AdminChallengePage() {
  await ensureChallengeLevelTable();
  const user = await getSessionUser();
  const maps = await prisma.challengeMap.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }], select: { id: true, title: true, artist: true, mapFileUrl: true, rating: true, status: true } });
  const assignments = await prisma.$queryRawUnsafe<Array<{ challengeMapId: string; level: number }>>('SELECT "challengeMapId", "level" FROM "ChallengeMapLevel" WHERE "level" BETWEEN 1 AND 10');
  const levels = new Map(assignments.map((assignment) => [assignment.challengeMapId, assignment.level]));
  const owner = Boolean(user && isOwner(user));

  return <div className="space-y-6"><section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow"><p className="text-sm uppercase tracking-[0.3em] text-accent">Challenge</p><h1 className="mt-2 text-3xl font-semibold text-white">Challenge and category management</h1><p className="mt-3 text-sm leading-7 text-muted">Manage Challenge and all five categories across Levels 1-10. Search the maps database and assign maps to a specific category and level.</p></section><ChallengeCategoryManager isOwner={owner} /><section><h2 className="mb-4 text-xl font-semibold text-white">Challenge level assignments</h2><ChallengeMapLevelManager initialMaps={maps.map((map) => ({ ...map, level: levels.get(map.id) ?? null }))} /></section></div>;
}
