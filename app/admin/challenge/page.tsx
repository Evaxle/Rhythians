import { prisma } from "@/lib/db";
import { ChallengeMapLevelManager } from "@/components/admin/challenge-map-level-manager";

export const dynamic = "force-dynamic";

export default async function AdminChallengePage() {
  const maps = await prisma.challengeMap.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: { id: true, title: true, artist: true, mapFileUrl: true, rating: true, status: true },
  });
  const assignments = maps.length === 0 ? [] : await prisma.$queryRawUnsafe<Array<{ challengeMapId: string; level: number }>>(
    'SELECT "challengeMapId", "level" FROM "ChallengeMapLevel"',
  );
  const levels = new Map(assignments.map((assignment) => [assignment.challengeMapId, assignment.level]));

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <p className="text-sm uppercase tracking-[0.3em] text-accent">Challenge</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Challenge level management</h1>
        <p className="mt-3 text-sm leading-7 text-muted">Assign approved Challenge maps to Levels 1-20. Maps that are not assigned to a level do not appear in Challenge progression.</p>
      </section>
      <ChallengeMapLevelManager initialMaps={maps.map((map) => ({ ...map, level: levels.get(map.id) ?? null }))} />
    </div>
  );
}
