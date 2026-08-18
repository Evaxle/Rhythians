import Link from "next/link";
import { Link2, LogIn, Trophy } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getDailyLeaderboard } from "@/lib/daily";
import { getChallengeLeaderboard } from "@/lib/maps";
import { LeaderboardTabs } from "@/components/daily/leaderboard-tabs";

export const dynamic = "force-dynamic";

export default async function LeaderboardsPage() {
  const user = await getSessionUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <section className="rounded-3xl border border-border bg-surface/95 p-10 text-center shadow-glow">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <LogIn size={26} />
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-white">Sign in to see the leaderboards</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
            Leaderboards are only available to members who link their Rhythia account. Sign in to get started.
          </p>
          <Link href="/login" className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent2">
            <LogIn size={16} /> Sign in
          </Link>
        </section>
      </div>
    );
  }

  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId: user.id }, select: { id: true } });

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <section className="rounded-3xl border border-border bg-surface/95 p-10 text-center shadow-glow">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <Link2 size={26} />
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-white">Link your Rhythia account</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
            To access the leaderboards you first need to link your Rhythia profile. Visit your profile page and
            connect your account.
          </p>
          <Link href={`/profile/${user.profileHandle}`} className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent2">
            <Link2 size={16} /> Go to my profile
          </Link>
        </section>
      </div>
    );
  }

  const dailyLeaderboards = await Promise.all(
    [0, 1, 2, 3, 4, 5, 6, 7, 8].map((rankIndex) => getDailyLeaderboard(rankIndex, 100))
  );
  const challengeLeaderboards = await Promise.all(
    [0, 1, 2, 3, 4, 5, 6, 7, 8].map((rankIndex) => getChallengeLeaderboard(rankIndex, 100))
  );

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <section className="space-y-2">
        <p className="flex items-center gap-2 text-sm uppercase tracking-[0.24em] text-accent">
          <Trophy size={16} /> Leaderboards
        </p>
        <h1 className="text-3xl font-semibold text-white">Rhythian standings</h1>
        <p className="text-sm text-muted">
          Earn Rhythian Points (RHP) by beating daily maps and ranked challenge maps to climb the ladder.
          Daily leaderboards track your daily map streak within your rank.
        </p>
      </section>

      <LeaderboardTabs
        dailyLeaderboards={dailyLeaderboards}
        challengeLeaderboards={challengeLeaderboards}
        currentUserId={user.id}
      />
    </div>
  );
}