import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getAvatarUrl } from "@/lib/avatar";
import { UserTags } from "@/components/user-tags";
import { FlagIcon } from "@/components/flag-icon";
import { FriendButton } from "@/components/friend-button";
import { ReportButton } from "@/components/report-button";
import { RhythiaConnect } from "@/components/rhythia-connect";
import { RhythiaStats } from "@/components/rhythia-stats";
import { getRhythiaStatus } from "@/lib/rhythia-status";
import { RankProgress } from "@/components/rank-progress";
import { getUserGlobalRank } from "@/lib/maps-legacy";
import { RhythiaVerifiedBadge } from "@/components/rhythia-verified-badge";
import { ProfileScoreRefresh } from "@/components/profile-score-refresh";
import { getUserCategoryLevels } from "@/lib/categories";
import { getUserChallengeLevel } from "@/lib/challenge";
import { RhythKitRecentScores } from "@/components/rhythkit-recent-scores";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ username: string }> };

function loadProfileUser(username: string) {
  return prisma.user.findFirst({
    where: { profileHandle: username },
    include: {
      clips: { where: { status: "approved" }, orderBy: { createdAt: "desc" }, include: { category: true, reviewedBy: { select: { username: true, displayName: true } } } },
      articleRevisions: true,
      roles: { include: { role: true } },
      playerRank: true,
      userTags: { include: { tag: true } },
      rhythiaProfile: true,
    },
  });
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const currentUser = await getSessionUser();
  let user: Awaited<ReturnType<typeof loadProfileUser>> | null = null;
  try {
    user = await loadProfileUser(username);
  } catch {
    const bare = await prisma.user.findFirst({ where: { profileHandle: username }, include: { roles: { include: { role: true } } } });
    if (bare) user = { ...bare, clips: [], articleRevisions: [], playerRank: null, userTags: [], rhythiaProfile: null } as Awaited<ReturnType<typeof loadProfileUser>>;
  }
  if (!user) return <p className="rounded-3xl border border-border bg-surface/95 p-8 text-muted">Profile not found.</p>;
  const isOwnProfile = currentUser?.id === user.id;
  const avatarUrl = getAvatarUrl(user, 256);
  const [rankResult, categoryResult, challengeResult, titleResult] = await Promise.allSettled([
    getUserGlobalRank(user.id),
    getUserCategoryLevels(user.id),
    getUserChallengeLevel(user.id),
    prisma.$queryRawUnsafe<Array<{ title: string; color: string }>>('SELECT "title", "color" FROM "UserProfileTitle" WHERE "userId" = $1 LIMIT 1', user.id),
  ]);
  const globalRank = rankResult.status === "fulfilled" ? rankResult.value : null;
  const categoryLevels = categoryResult.status === "fulfilled" ? categoryResult.value : [];
  const challengeLevel = challengeResult.status === "fulfilled" ? challengeResult.value : 0;
  const profileTitle = titleResult.status === "fulfilled" ? titleResult.value[0] ?? null : null;
  let presence: { isOnline: boolean; lastActiveAt: Date | null } | null = null;
  if (user.rhythiaProfile) presence = await getRhythiaStatus(user.rhythiaProfile).catch(() => null);
  let presenceLabel = "Offline";
  if (presence?.lastActiveAt) {
    const seconds = Math.floor((Date.now() - presence.lastActiveAt.getTime()) / 1000);
    if (seconds < 60) presenceLabel = "Active now";
    else if (seconds < 3600) presenceLabel = `Active ${Math.floor(seconds / 60)}m ago`;
    else if (seconds < 86400) presenceLabel = `Active ${Math.floor(seconds / 3600)}h ago`;
    else if (seconds < 2592000) presenceLabel = `Active ${Math.floor(seconds / 86400)}d ago`;
    else presenceLabel = `Last seen ${presence.lastActiveAt.toLocaleDateString()}`;
  } else presenceLabel = "Never seen online";
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-6">
            {avatarUrl ? <img src={avatarUrl} alt={`${user.username}'s avatar`} className="h-24 w-24 rounded-full border-2 border-accent/30" /> : <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-accent/30 bg-accent/10 text-3xl font-bold text-accent">{user.username.charAt(0).toUpperCase()}</div>}
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-accent">Profile</p>
              <h1 className="mt-2 flex flex-wrap items-center gap-3 text-3xl font-semibold text-white">{user.displayName ?? user.username}{user.rhythiaProfile?.flag && <FlagIcon flag={user.rhythiaProfile.flag} country={user.rhythiaProfile.country} size="md" />}{user.rhythiaVerified && <RhythiaVerifiedBadge size="sm" />}{user.rhythiaProfile && presence && <span title={presenceLabel} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${presence.isOnline ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-red-400/40 bg-red-400/10 text-red-300"}`}><span className={`h-2 w-2 rounded-full ${presence.isOnline ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-red-400/70"}`} />{presence.isOnline ? "Online" : "Offline"}</span>}</h1>
              {profileTitle && <p className="mt-1 text-base font-semibold" style={{ color: profileTitle.color }}>{profileTitle.title}</p>}
              <p className="mt-1 text-sm text-muted">@{user.profileHandle}</p>
              {user.userTags.length > 0 && <div className="mt-4"><UserTags tags={user.userTags} size="md" /></div>}
              {user.bio && <p className="mt-4 text-sm leading-7 text-muted">{user.bio}</p>}
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-3">
            {!isOwnProfile && <FriendButton userId={user.id} />}
            {isOwnProfile && <div className="flex items-center gap-2"><div className="flex-1"><RhythiaConnect connectedUrl={user.rhythiaProfile?.profileUrl} /></div>{user.rhythiaProfile && <ProfileScoreRefresh />}</div>}
            {!isOwnProfile && <Link href={`/messages?user=${encodeURIComponent(user.profileHandle)}`} className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-accent/40"><MessageCircle size={16} /> Message</Link>}
            {currentUser && !isOwnProfile && <ReportButton targetType="user" targetId={user.id} targetLabel={user.username} />}
            <div className="rounded-3xl border border-border bg-background/80 px-5 py-4 text-sm text-muted"><p>Member since</p><p className="mt-2 text-lg font-semibold text-white">{user.joinedAt.toLocaleDateString()}</p></div>
            {user.avgMapRating != null && <div className="rounded-3xl border border-border bg-background/80 px-5 py-4 text-sm text-muted"><p>Average map rating</p><p className="mt-2 text-lg font-semibold text-white">{user.avgMapRating.toFixed(2)}</p></div>}
            <div className="rounded-3xl border border-accent/30 bg-accent/10 px-5 py-4"><RankProgress rhp={user.rhp} globalRank={globalRank} highestSkillLevel={challengeLevel} /></div>
          </div>
        </div>
      </section>
      {user.rhythiaProfile && <RhythiaStats profile={user.rhythiaProfile} />}
      <RhythKitRecentScores userId={user.id} />
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm uppercase tracking-[0.3em] text-accent">Categories</p><h2 className="mt-2 text-2xl font-semibold text-white">Skill category levels</h2></div><Link href="/categories" className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent/20">View categories</Link></div><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{categoryLevels.map(({ category, level }) => <div key={category} className="rounded-2xl border border-border bg-background/60 p-4"><p className="text-xs uppercase tracking-[0.2em] text-accent">{category === "off_grid" ? "Off Grid" : category.charAt(0).toUpperCase() + category.slice(1)}</p><p className="mt-2 text-2xl font-semibold text-white">Level {level}</p></div>)}</div></section>
      <section className="space-y-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm uppercase tracking-[0.3em] text-accent">Clips</p><h2 className="mt-2 text-2xl font-semibold text-white">Approved clips from this creator</h2></div><p className="text-sm text-muted">{user.clips.length} approved clip{user.clips.length === 1 ? "" : "s"}</p></div>{user.clips.length === 0 ? <div className="rounded-3xl border border-border bg-background/80 p-8 text-sm text-muted">No approved clips are visible yet.</div> : <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{user.clips.map((clip) => <Link key={clip.id} href={`/clips/${clip.id}`} className="overflow-hidden rounded-3xl border border-border bg-surface/95 p-5 transition hover:-translate-y-0.5 hover:border-accent/40"><div className="h-40 rounded-3xl bg-white/5" /><div className="mt-4"><p className="text-sm uppercase tracking-[0.24em] text-accent">{clip.category?.name ?? "Uncategorized"}</p><h3 className="mt-3 text-lg font-semibold text-white">{clip.title}</h3>{clip.reviewedBy && <p className="mt-2 text-xs text-muted">Approved by <span className="font-semibold text-white">{clip.reviewedBy.displayName ?? clip.reviewedBy.username}</span></p>}<p className="mt-2 text-sm text-muted">{clip.createdAt.toLocaleDateString()}</p></div></Link>)}</div>}</section>
    </div>
  );
}
