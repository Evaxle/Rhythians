import Link from "next/link";
import { Link2, LogIn, Trophy } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getDailyLeaderboard } from "@/lib/daily";
import { getChallengeLeaderboard } from "@/lib/maps-legacy";
import { getChallengeLevelLeaderboard } from "@/lib/challenge";
import { getRankInfo } from "@/lib/ranks";
import { LeaderboardTabs } from "@/components/daily/leaderboard-tabs";

export const dynamic = "force-dynamic";

const ranks = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const cameraModes = ["lock", "spin", "vr"] as const;
type CameraMode = (typeof cameraModes)[number];

function filterCameraRows<T extends { userId: string }>(rows: T[], cameraUserIds: Set<string>) {
  return rows.filter((row) => cameraUserIds.has(row.userId)).map((row, index) => ({ ...row, position: index + 1 }));
}

export default async function LeaderboardsPage() {
  const user = await getSessionUser();
  if (!user) return <div className="ui-page max-w-3xl"><section className="ui-card rounded-[2rem] p-10 text-center shadow-glow"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent"><LogIn size={26} /></div><h1 className="mt-5 text-2xl font-semibold text-white">Sign in to see the leaderboards</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">Leaderboards are only available to members who link their Rhythia account. Sign in to get started.</p><Link href="/login" className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent2"><LogIn size={16} /> Sign in</Link></section></div>;
  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!profile) return <div className="ui-page max-w-3xl"><section className="ui-card rounded-[2rem] p-10 text-center shadow-glow"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent"><Link2 size={26} /></div><h1 className="mt-5 text-2xl font-semibold text-white">Link your Rhythia account</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">To access the leaderboards you first need to link your Rhythia profile.</p><Link href={`/profile/${user.profileHandle}`} className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent2"><Link2 size={16} /> Go to my profile</Link></section></div>;

  const userRank = getRankInfo(user.rhp).index;
  const dailyLeaderboards = await Promise.all(ranks.map((rankIndex) => getDailyLeaderboard(rankIndex, 100)));
  const rankedLeaderboards = await Promise.all(ranks.map((rankIndex) => getChallengeLeaderboard(rankIndex, 100)));
  const challengeLevelLeaderboard = await getChallengeLevelLeaderboard(100);
  const allUserIds = [...new Set([...dailyLeaderboards.flat(), ...rankedLeaderboards.flat()].map((row) => row.userId))];
  const userTags = await prisma.userTag.findMany({ where: { userId: { in: allUserIds } }, select: { userId: true, tag: { select: { slug: true } } } });
  const cameraUserIds: Record<CameraMode, Set<string>> = { lock: new Set(), spin: new Set(), vr: new Set() };
  for (const entry of userTags) {
    const slug = entry.tag.slug.toLowerCase();
    if (slug === "camera-lock") cameraUserIds.lock.add(entry.userId);
    if (slug === "camera-spin") cameraUserIds.spin.add(entry.userId);
    if (slug === "camera-vr") cameraUserIds.vr.add(entry.userId);
  }
  const dailyCameraLeaderboards = { lock: dailyLeaderboards.map((rows) => filterCameraRows(rows, cameraUserIds.lock)), spin: dailyLeaderboards.map((rows) => filterCameraRows(rows, cameraUserIds.spin)), vr: dailyLeaderboards.map((rows) => filterCameraRows(rows, cameraUserIds.vr)) };
  const rankedCameraLeaderboards = { lock: rankedLeaderboards.map((rows) => filterCameraRows(rows, cameraUserIds.lock)), spin: rankedLeaderboards.map((rows) => filterCameraRows(rows, cameraUserIds.spin)), vr: rankedLeaderboards.map((rows) => filterCameraRows(rows, cameraUserIds.vr)) };

  return <div className="ui-page space-y-6"><section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_8%_0%,rgba(124,143,240,0.16),transparent_30%),radial-gradient(circle_at_92%_100%,rgba(167,139,250,0.08),transparent_28%),linear-gradient(145deg,rgba(20,27,45,0.95),rgba(9,13,23,0.98))] p-6 shadow-glow sm:p-8"><div className="relative flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><p className="flex items-center gap-2 text-sm uppercase tracking-[0.24em] text-accent"><Trophy size={16} /> Leaderboards</p><h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-white">Rhythian standings</h1><p className="mt-2 max-w-3xl text-sm leading-7 text-muted">Compare daily results, ranked map RHP, camera-mode ladders, and Challenge Level progression.</p></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3"><p className="text-[10px] uppercase tracking-[0.18em] text-muted">Your rank</p><p className="mt-1 text-sm font-semibold text-white">{getRankInfo(user.rhp).isExpert ? "Expert" : `${getRankInfo(user.rhp).name} ${getRankInfo(user.rhp).tier}`}</p></div><div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.04] px-4 py-3"><p className="text-[10px] uppercase tracking-[0.18em] text-muted">RHP</p><p className="mt-1 text-sm font-semibold text-white">{user.rhp.toLocaleString()}</p></div><div className="hidden rounded-2xl border border-violet-400/15 bg-violet-400/[0.04] px-4 py-3 sm:block"><p className="text-[10px] uppercase tracking-[0.18em] text-muted">Rank bands</p><p className="mt-1 text-sm font-semibold text-white">{ranks.length}</p></div></div></div></section><section className="ui-card rounded-[2rem] p-5 sm:p-7"><LeaderboardTabs dailyLeaderboards={dailyLeaderboards} dailyCameraLeaderboards={dailyCameraLeaderboards} challengeLeaderboards={rankedLeaderboards} rankedCameraLeaderboards={rankedCameraLeaderboards} challengeLevelLeaderboard={challengeLevelLeaderboard} currentUserId={user.id} initialRankIndex={userRank} /></section></div>;
}
