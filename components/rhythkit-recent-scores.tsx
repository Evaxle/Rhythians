import { prisma } from "@/lib/db";

export async function RhythKitRecentScores({ userId }: { userId: string }) {
  const scores = await prisma.$queryRawUnsafe<Array<{ id: string; challengeMapId: string; title: string; rating: number; accuracy: number | null; points: number; submittedAt: Date }>>(`SELECT s."id", s."challengeMapId", m."title", m."rating", s."accuracy", s."points", s."submittedAt" FROM "RhythKitScore" s JOIN "ChallengeMap" m ON m."id" = s."challengeMapId" WHERE s."userId" = $1 ORDER BY s."submittedAt" DESC LIMIT 10`, userId);

  return (
    <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-accent">RhythKit</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Recent scores</h2>
        </div>
        <p className="text-sm text-muted">Mod scores only</p>
      </div>
      {scores.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-border bg-background/60 p-5 text-sm text-muted">No RhythKit scores recorded yet.</div>
      ) : (
        <div className="mt-6 space-y-3">
          {scores.map((score) => (
            <div key={score.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">{score.title}</p>
                <p className="mt-1 text-xs text-muted">{score.rating.toFixed(2)} RHP map · {score.accuracy == null ? "Accuracy unavailable" : `${score.accuracy.toFixed(2)}%`} · {score.submittedAt.toLocaleString()}</p>
              </div>
              <p className="shrink-0 text-lg font-semibold text-accent">+{score.points} RHP</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
