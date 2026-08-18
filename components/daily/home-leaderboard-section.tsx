import Link from "next/link";
import { ArrowRight, Link2, Lock, Trophy } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getDailyLeaderboard } from "@/lib/daily";
import { getRankInfo } from "@/lib/ranks";

export async function HomeLeaderboardSection() {
  const user = await getSessionUser();

  if (!user) {
    return (
      <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
        <div className="flex items-center gap-3 text-sm uppercase tracking-[0.24em] text-accent">
          <Trophy size={18} /> Leaderboards
        </div>
        <div className="mt-6 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <Lock size={24} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Sign in to see the standings</h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              Daily and challenge leaderboards track the members who beat the most maps for Rhythian Points.
            </p>
            <Link href="/login" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-accent transition hover:text-white">
              Sign in <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId: user.id }, select: { id: true } });

  if (!profile) {
    return (
      <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
        <div className="flex items-center gap-3 text-sm uppercase tracking-[0.24em] text-accent">
          <Trophy size={18} /> Leaderboards
        </div>
        <div className="mt-6 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <Link2 size={24} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Link your Rhythia account to compete</h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              Leaderboards are reserved for members with a linked Rhythia profile.
            </p>
            <Link href={`/profile/${user.profileHandle}`} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-accent transition hover:text-white">
              Link your account <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const userRow = await prisma.user.findUnique({ where: { id: user.id }, select: { rhp: true } });
  const rankInfo = getRankInfo(userRow?.rhp ?? 0);
  const rows = await getDailyLeaderboard(rankInfo.index, 5);

  return (
    <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm uppercase tracking-[0.24em] text-accent">
          <Trophy size={18} /> Daily leaderboard
        </div>
        <Link href="/leaderboards" className="inline-flex items-center gap-1 text-sm font-semibold text-accent transition hover:text-white">
          All boards <ArrowRight size={15} />
        </Link>
      </div>
      <p className="mt-2 text-sm text-muted">Top daily map streaks in <span style={{ color: rankInfo.color }} className="font-semibold">{rankInfo.name}</span>.</p>

      <div className="mt-5 space-y-2">
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-border bg-background/70 p-5 text-sm text-muted">
            No daily maps beaten in your rank yet. Beat today&apos;s map to start a streak.
          </p>
        ) : (
          rows.map((row, index) => (
            <div key={row.userId} className="flex items-center gap-3 rounded-2xl border border-border bg-background/70 px-4 py-3">
              <span className={`w-6 text-center text-sm font-bold ${index < 3 ? (index === 0 ? "text-amber-400" : index === 1 ? "text-slate-300" : "text-amber-700") : "text-muted"}`}>
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <Link href={`/profile/${row.profileHandle}`} className="truncate text-sm font-semibold text-white hover:text-accent">
                  {row.displayName ?? row.username}
                </Link>
                <p className="text-xs text-muted">{row.rhp.toLocaleString()} RHP</p>
              </div>
              <span className="text-sm font-semibold text-white">{row.streak}</span>
              <span className="text-xs text-muted">day{row.streak === 1 ? "" : "s"}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}