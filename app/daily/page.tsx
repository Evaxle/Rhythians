import Link from "next/link";
import { Link2, LogIn, Sparkles, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getOrCreateDailyMap, formatDailyDate, rhpForMap, getRankedMapsCached } from "@/lib/daily";
import { getUserDailyStatusAcrossRankChange } from "@/lib/daily-compat";
import { getRankInfo } from "@/lib/ranks";
import { DailyMapCard } from "@/components/daily/daily-map-card";

export const dynamic = "force-dynamic";

export default async function DailyPage() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <section className="rounded-3xl border border-border bg-surface/95 p-10 text-center shadow-glow">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent"><LogIn size={26} /></div>
          <h1 className="mt-5 text-2xl font-semibold text-white">Sign in to see the daily map</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">The daily map, leaderboards, and Rhythian Points are only available to members who link their Rhythia account. Sign in to get started.</p>
          <Link href="/login" className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent2"><LogIn size={16} /> Sign in</Link>
        </section>
      </div>
    );
  }

  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId: user.id } });
  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <section className="rounded-3xl border border-border bg-surface/95 p-10 text-center shadow-glow">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent"><Link2 size={26} /></div>
          <h1 className="mt-5 text-2xl font-semibold text-white">Link your Rhythia account</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">To access the daily map and leaderboards you first need to link your Rhythia profile. Visit your profile page and connect your account.</p>
          <Link href={`/profile/${user.profileHandle}`} className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent2"><Link2 size={16} /> Go to my profile</Link>
        </section>
      </div>
    );
  }

  const userRow = await prisma.user.findUnique({ where: { id: user.id }, select: { rhp: true, dailyStreak: true } });
  const rankInfo = getRankInfo(userRow?.rhp ?? 0);
  const daily = await getOrCreateDailyMap(rankInfo.index);
  const status = await getUserDailyStatusAcrossRankChange(user.id);
  const randomMaps = (await getRankedMapsCached()).map((map) => ({ id: map.id, title: map.title }));

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <section className="space-y-2">
        <p className="flex items-center gap-2 text-sm uppercase tracking-[0.24em] text-accent"><Sparkles size={16} /> Daily challenge</p>
        <h1 className="text-3xl font-semibold text-white">Today&apos;s map</h1>
        <p className="text-sm text-muted">A daily map matched to your {rankInfo.name} rank ({rankInfo.rangeMin.toFixed(2)}–{rankInfo.rangeMax.toFixed(2)} rating). Beat it for Rhythian Points (RHP) — {formatDailyDate(daily.date)}, worth <span className="font-semibold text-white">{rhpForMap(daily.starRating, rankInfo.index)} RHP</span> at 100% accuracy (scaled by accuracy and speed, based on your {rankInfo.name} rank).{status?.streak ? ` Your streak: ${status.streak} day${status.streak === 1 ? "" : "s"}.` : ""}</p>
      </section>

      {status?.beatFromPreviousRank && (
        <div className="flex items-start gap-3 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-4 text-sm text-yellow-100">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <p>You already beat today&apos;s daily map for your previous rank. It counted for today, so beating the new rank&apos;s daily map will not award another daily completion or RHP.</p>
        </div>
      )}

      <DailyMapCard
        dailyMap={{ id: daily.id, date: daily.date.toISOString().slice(0, 10), title: daily.title, artist: daily.artist, difficulty: daily.difficulty, starRating: daily.starRating, noteCount: daily.noteCount, length: daily.length, playcount: daily.playcount, downloadUrl: daily.downloadUrl, imageUrl: daily.imageUrl, mapperName: daily.mapperName }}
        initialBeat={status?.beat ?? null}
        userRhp={userRow?.rhp ?? 0}
        streak={status?.streak ?? 0}
        rankName={rankInfo.name}
        randomMaps={randomMaps}
      />
    </div>
  );
}
