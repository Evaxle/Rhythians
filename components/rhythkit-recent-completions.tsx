import { prisma } from "@/lib/db";

export async function RhythKitRecentCompletions({ userId }: { userId: string }) {
  const scores = await prisma.$queryRawUnsafe<Array<{ id: string; mapId: string; mapName: string; completedAt: Date; ranked: boolean; rhpAwarded: number | null; matchedMapId: string | null }>>(`SELECT id, map_id AS "mapId", map_name AS "mapName", completed_at AS "completedAt", ranked, rhp_awarded AS "rhpAwarded", matched_map_id AS "matchedMapId" FROM public.rhythkit_maps WHERE user_id = $1 ORDER BY completed_at DESC LIMIT 10`, userId);

  return (
    <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
      <div className="flex items-end justify-between gap-4">
        <div><p className="text-sm uppercase tracking-[0.3em] text-accent">RhythKit</p><h2 className="mt-2 text-2xl font-semibold text-white">Recent scores</h2></div>
        <p className="text-sm text-muted">Recent completions</p>
      </div>
      {scores.length === 0 ? <div className="mt-6 rounded-2xl border border-border bg-background/60 p-5 text-sm text-muted">No RhythKit scores recorded yet.</div> : <div className="mt-6 space-y-3">{scores.map((score) => <div key={score.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate font-semibold text-white">{score.mapName}</p><p className="mt-1 text-xs text-muted">Map ID: {score.mapId} · {score.completedAt.toLocaleString()}</p></div><div className="shrink-0 text-right"><p className="text-sm font-semibold text-white">{score.ranked ? "Ranked" : "Unranked"}</p>{score.rhpAwarded != null && score.rhpAwarded > 0 && <p className="text-lg font-semibold text-accent">+{score.rhpAwarded} RHP</p>}</div></div>)}</div>}
    </section>
  );
}
