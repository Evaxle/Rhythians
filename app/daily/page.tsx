import Link from "next/link";
import { Link2, LogIn, Sparkles, AlertTriangle, CalendarDays, Trophy } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getOrCreateDailyMap, formatDailyDate, rhpForMap, getRankedMapsCached } from "@/lib/daily";
import { getUserDailyStatusAcrossRankChange } from "@/lib/daily-compat";
import { getRankInfo } from "@/lib/ranks";
import { RankIcon } from "@/components/rank-icon";
import { DailyMapCard } from "@/components/daily/daily-map-card";

export const dynamic = "force-dynamic";

export default async function DailyPage() {
  const user = await getSessionUser();
  if (!user) return <div className="mx-auto max-w-2xl px-4 py-10"><section className="rounded-3xl border border-border bg-surface/95 p-10 text-center shadow-glow"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent"><LogIn size={26} /></div><h1 className="mt-5 text-2xl font-semibold text-white">Sign in to see the daily map</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">The daily map, leaderboards, and Rhythian Points are only available to members who link their Rhythia account.</p><Link href="/login" className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white"><LogIn size={16} /> Sign in</Link></section></div>;
  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId: user.id } });
  if (!profile) return <div className="mx-auto max-w-2xl px-4 py-10"><section className="rounded-3xl border border-border bg-surface/95 p-10 text-center shadow-glow"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent"><Link2 size={26} /></div><h1 className="mt-5 text-2xl font-semibold text-white">Link your Rhythia account</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">To access the daily map and leaderboards you first need to link your Rhythia profile.</p><Link href={`/profile/${user.profileHandle}`} className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white"><Link2 size={16} /> Go to my profile</Link></section></div>;

  const userRow = await prisma.user.findUnique({ where: { id: user.id }, select: { rhp: true, dailyStreak: true } });
  const rankInfo = getRankInfo(userRow?.rhp ?? 0);
  const daily = await getOrCreateDailyMap(rankInfo.index);
  const status = await getUserDailyStatusAcrossRankChange(user.id);
  const randomMaps = (await getRankedMapsCached()).map((map) => ({ id: map.id, title: map.title }));

  return <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-10"><div className="space-y-7"><section className="overflow-hidden rounded-[2rem] border border-border bg-surface/95 p-6 shadow-glow sm:p-8"><div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between"><div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.28em] text-accent"><Sparkles size={15} /> Daily challenge</p><h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">Today&apos;s map</h1><p className="mt-3 text-sm leading-7 text-muted">{formatDailyDate(daily.date)} · A daily map matched to your current ranked range.</p></div><div className="flex items-center gap-3 rounded-2xl border border-border bg-background/50 p-3"><RankIcon rank={rankInfo} size={48} /><div><p className="text-[10px] uppercase tracking-[0.18em] text-muted">Your rank</p><p className="font-bold" style={{ color: rankInfo.color }}>{rankInfo.isExpert ? "Expert" : `${rankInfo.name} ${rankInfo.tier}`}</p><p className="text-xs text-muted">{userRow?.rhp.toLocaleString() ?? 0} RHP</p></div></div></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-border bg-background/50 p-4"><p className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted"><CalendarDays size={14} /> Date</p><p className="mt-2 text-sm font-semibold text-white">{formatDailyDate(daily.date)}</p></div><div className="rounded-2xl border border-border bg-background/50 p-4"><p className="text-xs uppercase tracking-wider text-muted">Map rank</p><div className="mt-2 flex items-center gap-2"><RankIcon rank={{ ...rankInfo, tier: 1 }} size={28} /><span className="text-sm font-semibold" style={{ color: rankInfo.color }}>{rankInfo.name}</span></div></div><div className="rounded-2xl border border-border bg-background/50 p-4"><p className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted"><Trophy size={14} /> Reward</p><p className="mt-2 text-sm font-semibold text-white">{rhpForMap(daily.starRating, rankInfo.index)} RHP at 100%</p></div></div></section>

    {status?.beatFromPreviousRank && <div className="flex items-start gap-3 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-4 text-sm text-yellow-100"><AlertTriangle size={18} className="mt-0.5 shrink-0" /><p>You already beat today&apos;s daily map for your previous rank. It counted for today, so beating the new rank&apos;s daily map will not award another daily completion or RHP.</p></div>}

    <DailyMapCard dailyMap={{ id: daily.id, date: daily.date.toISOString().slice(0, 10), title: daily.title, artist: daily.artist, difficulty: daily.difficulty, starRating: daily.starRating, noteCount: daily.noteCount, length: daily.length, playcount: daily.playcount, downloadUrl: daily.downloadUrl, imageUrl: daily.imageUrl, mapperName: daily.mapperName }} initialBeat={status?.beat ?? null} userRhp={userRow?.rhp ?? 0} streak={status?.streak ?? 0} rankName={rankInfo.name} randomMaps={randomMaps} />
  </div></div>;
}
