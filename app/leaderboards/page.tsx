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
  if (!user) return <div className="mx-auto max-w-2xl space-y-6"><section className="rounded-3xl border border-border bg-surface/95 p-10 text-center shadow-glow"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent"><LogIn size={26} /></div><h1 className="mt-5 text-2xl font-semibold text-white">Sign in to see the leaderboards</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">Leaderboards are only available to members who link their Rhythia account. Sign in to get started.</p><Link href="/login" className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent2"><LogIn size={16} /> Sign in</Link></section></div>;
  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!profile) return <div className="mx-auto max-w-2xl space-y-6"><section className="rounded-3xl border border-border bg-surface/95 p-10 text-center shadow-glow"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent"><Link2 size={26} /></div><h1 className="mt-5 text-2xl font-semibold text-white">Link your Rhythia account</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">To access the leaderboards you first need to link your Rhythia profile.</p><Link href={`/profile/${user.profileHandle}`} className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent2"><Link2 size={16} /> Go to my profile</Link></section></div>;

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

  const dailyCameraLeaderboards = {
    lock: dailyLeaderboards.map((rows) => filterCameraRows(rows, cameraUserIds.lock)),
    spin: dailyLeaderboards.map((rows) => filterCameraRows(rows, cameraUserIds.spin)),
    vr: dailyLeaderboards.map((rows) => filterCameraRows(rows, cameraUserIds.vr)),
  };
  const rankedCameraLeaderboards = {
    lock: rankedLeaderboards.map((rows) => filterCameraRows(rows, cameraUserIds.lock)),
    spin: rankedLeaderboards.map((rows) => filterCameraRows(rows, cameraUserIds.spin)),
    vr: rankedLeaderboards.map((rows) => filterCameraRows(rows, cameraUserIds.vr)),
  };

  return <div className="mx-auto max-w-4xl space-y-8"><section className="space-y-2"><p className="flex items-center gap-2 text-sm uppercase tracking-[0.24em] text-accent"><Trophy size={16} /> Leaderboards</p><h1 className="text-3xl font-semibold text-white">Rhythian standings</h1><p className="text-sm text-muted">Compare daily results, ranked map RHP, and the separate Challenge Level progression.</p></section><LeaderboardTabs dailyLeaderboards={dailyLeaderboards} dailyCameraLeaderboards={dailyCameraLeaderboards} challengeLeaderboards={rankedLeaderboards} rankedCameraLeaderboards={rankedCameraLeaderboards} challengeLevelLeaderboard={challengeLevelLeaderboard} currentUserId={user.id} initialRankIndex={userRank} /></div>;
}
