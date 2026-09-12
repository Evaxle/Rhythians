import Link from "next/link";
import { Suspense } from "react";
import { after } from "next/server";
import {
  CalendarDays,
  ExternalLink,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getAvatarUrl } from "@/lib/avatar";
import { UserTags } from "@/components/user-tags";
import { UserName } from "@/components/user-name";
import { ProfileTagEditor } from "@/components/profile-tag-editor";
import { ProfileShare } from "@/components/profile-share";
import { ProfileBattleButton } from "@/components/profile-battle-button";
import { FlagIcon } from "@/components/flag-icon";
import { FriendButton } from "@/components/friend-button";
import { ReportButton } from "@/components/report-button";
import { RhythiaConnect } from "@/components/rhythia-connect";
import { RhythiaStats } from "@/components/rhythia-stats";
import { getRhythiaStatus } from "@/lib/rhythia-status";
import { getUserGlobalRank } from "@/lib/maps-legacy";
import { RhythiaVerifiedBadge } from "@/components/rhythia-verified-badge";
import { getUserCategoryLevels } from "@/lib/categories";
import { CATEGORY_LABELS } from "@/lib/category-constants";
import { getProfileChallenge } from "@/lib/profile-challenge";
import { RhythKitRecentCompletions } from "@/components/rhythkit-recent-completions";
import { getReferralProgress } from "@/lib/referrals";
import { getRankInfo } from "@/lib/ranks";
import { RankIcon } from "@/components/rank-icon";
import { ModeRankCards } from "@/components/mode-rank-progress";
import { RbpProfileCard } from "@/components/profile/rbp-profile-card";
import {
  getCachedModePoints,
  getReliableModePoints,
} from "@/lib/profile-points";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ username: string }> };

const AUTOMATIC_TAG_SLUGS = new Set([
  "beginner",
  "intermediate",
  "experienced",
  "expert",
  "veteran",
  "mentor",
]);

function loadProfileUser(username: string) {
  return prisma.user.findFirst({
    where: { profileHandle: username },
    include: {
      clips: {
        where: { status: "approved" },
        orderBy: { createdAt: "desc" },
        include: {
          category: true,
          reviewedBy: { select: { username: true, displayName: true } },
        },
      },
      roles: { include: { role: true } },
      playerRank: true,
      userTags: { include: { tag: true } },
      rhythiaProfile: true,
    },
  });
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const currentUserPromise = getSessionUser();
  let user: Awaited<ReturnType<typeof loadProfileUser>> | null = null;
  try {
    user = await loadProfileUser(username);
  } catch {
    const bare = await prisma.user.findFirst({
      where: { profileHandle: username },
      include: { roles: { include: { role: true } } },
    });
    if (bare)
      user = {
        ...bare,
        clips: [],
        playerRank: null,
        userTags: [],
        rhythiaProfile: null,
      } as Awaited<ReturnType<typeof loadProfileUser>>;
  }
  if (!user)
    return (
      <p className="rounded-3xl border border-border bg-surface/95 p-8 text-muted">
        Profile not found.
      </p>
    );

  const currentUser = await currentUserPromise;
  const isOwnProfile = currentUser?.id === user.id;
  const isCoach = user.userTags.some(
    (entry) => entry.tag.slug === "rhythian-coach",
  );
  const avatarUrl = getAvatarUrl(user, 256);
  const [
    rankResult,
    categoryResult,
    favoriteResult,
    titleResult,
    selectedTagResult,
    modeResult,
    referralResult,
  ] = await Promise.allSettled([
    getUserGlobalRank(user.id),
    getUserCategoryLevels(user.id),
    prisma.$queryRawUnsafe<Array<{ favoriteCategory: string | null }>>(
      'SELECT "favoriteCategory" FROM "User" WHERE "id" = $1 LIMIT 1',
      user.id,
    ),
    prisma.$queryRawUnsafe<
      Array<{ title: string; color: string; neon: boolean }>
    >(
      'SELECT "title", "color", "neon" FROM "UserProfileTitle" WHERE "userId" = $1 LIMIT 1',
      user.id,
    ),
    prisma.$queryRawUnsafe<Array<{ tagId: string }>>(
      'SELECT "tagId" FROM "UserProfileTag" WHERE "userId" = $1 ORDER BY "position" ASC',
      user.id,
    ),
    user.rhythiaProfile ? getCachedModePoints(user.id) : Promise.resolve(null),
    isOwnProfile ? getReferralProgress(user.id) : Promise.resolve(null),
  ]);
  const modeSnapshot =
    modeResult.status === "fulfilled" ? modeResult.value : null;
  const modePoints = modeSnapshot?.points ?? { lock: 0, spin: 0, vr: 0 };
  const displayRhp = modeSnapshot?.rhp ?? user.rhp;
  const referralProgress =
    referralResult.status === "fulfilled" ? referralResult.value : null;
  const profileId = user.id;
  const linkedProfile = user.rhythiaProfile;
  if (linkedProfile)
    after(async () => {
      await Promise.allSettled([
        getReliableModePoints(profileId),
        getRhythiaStatus(linkedProfile),
      ]);
    });

  const globalRank =
    rankResult.status === "fulfilled" ? rankResult.value : null;
  const categoryLevels =
    categoryResult.status === "fulfilled" ? categoryResult.value : [];
  const savedFavorite =
    favoriteResult.status === "fulfilled"
      ? favoriteResult.value[0]?.favoriteCategory
      : null;
  const { category: favoriteCategory, level: challengeLevel } =
    getProfileChallenge(
      savedFavorite,
      categoryResult.status === "fulfilled" ? categoryLevels : null,
    );
  const profileTitle =
    titleResult.status === "fulfilled" ? (titleResult.value[0] ?? null) : null;
  const selectedTagIds =
    selectedTagResult.status === "fulfilled"
      ? selectedTagResult.value.map((entry) => entry.tagId)
      : [];
  const selectedTags = selectedTagIds
    .map((id) => user.userTags.find((entry) => entry.tagId === id))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  const automaticProfileTags = user.userTags.filter(
    (entry) => entry.tag.slug === "veteran" || entry.tag.slug === "mentor",
  );
  const displayTags = [
    ...selectedTags,
    ...automaticProfileTags.filter(
      (entry) =>
        !selectedTags.some((selected) => selected.tagId === entry.tagId),
    ),
  ];
  const editableTags = user.userTags.filter(
    (entry) =>
      entry.tag.slug !== "rhythian-coach" &&
      entry.tag.slug !== "contributor" &&
      !AUTOMATIC_TAG_SLUGS.has(entry.tag.slug),
  );
  const editableSelectedTagIds = selectedTags
    .filter(
      (entry) =>
        entry.tag.slug !== "rhythian-coach" &&
        entry.tag.slug !== "contributor" &&
        !AUTOMATIC_TAG_SLUGS.has(entry.tag.slug),
    )
    .map((entry) => entry.tagId);

  const presence = user.rhythiaProfile;
  const presenceLabel = presence?.lastActiveAt
    ? `Last active ${presence.lastActiveAt.toLocaleString()}`
    : "No recent activity";

  const titleStyle = profileTitle?.neon
    ? {
        color: profileTitle.color,
        textShadow: `0 0 5px ${profileTitle.color}, 0 0 14px ${profileTitle.color}, 0 0 28px ${profileTitle.color}`,
      }
    : profileTitle
      ? { color: profileTitle.color }
      : undefined;
  const mainRank = getRankInfo(displayRhp);

  return (
    <div className="ui-page profile-page space-y-6">
      <section className="relative overflow-hidden rounded-[2.2rem] border border-accent/15 bg-[radial-gradient(circle_at_8%_0%,rgba(124,143,240,0.17),transparent_32%),radial-gradient(circle_at_92%_100%,rgba(244,63,94,0.08),transparent_28%),linear-gradient(145deg,rgba(20,27,45,0.98),rgba(9,13,23,0.98))] p-5 shadow-glow sm:p-7 lg:p-8">
        <div className="grid gap-6">
          <div className="profile-identity flex min-w-0 flex-col p-1 sm:p-2">
            <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  width={112}
                  height={112}
                  alt={`${user.username}'s avatar`}
                  className="h-28 w-28 shrink-0 rounded-[1.75rem] border-2 border-accent/25 object-cover shadow-xl"
                />
              ) : (
                <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-[1.75rem] border-2 border-accent/25 bg-accent/10 text-4xl font-bold text-accent">
                  {user.username.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-accent">
                  Rhythians profile
                </p>
                <h1 className="mt-2 flex flex-wrap items-center justify-center gap-2 text-3xl sm:justify-start font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                  <UserName
                    username={user.displayName ?? user.username}
                    isCoach={isCoach}
                  />
                  {user.rhythiaProfile?.flag && (
                    <FlagIcon
                      flag={user.rhythiaProfile.flag}
                      country={user.rhythiaProfile.country}
                      size="md"
                    />
                  )}
                  {user.rhythiaVerified && <RhythiaVerifiedBadge size="sm" />}
                </h1>
                <p className="mt-1 text-sm text-muted">@{user.profileHandle}</p>
                {user.playerRank && (
                  <p
                    className="mt-2 text-sm font-semibold"
                    style={{ color: user.playerRank.color ?? "#7289da" }}
                  >
                    {user.playerRank.name}
                  </p>
                )}
                {profileTitle && (
                  <p className="mt-2 text-sm font-semibold" style={titleStyle}>
                    {profileTitle.title}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                  {user.rhythiaProfile && (
                    <span
                      title={presenceLabel}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${presence?.isOnline ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-white/10 bg-white/5 text-muted"}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${presence?.isOnline ? "bg-emerald-400" : "bg-white/30"}`}
                      />
                      {presence?.isOnline ? "Online" : presenceLabel}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-muted">
                    <CalendarDays size={12} /> Joined{" "}
                    {user.joinedAt.toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
            {displayTags.length > 0 && (
              <div className="mt-5">
                <UserTags tags={displayTags} size="md" />
              </div>
            )}
            {user.bio ? (
              <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-white/70">
                {user.bio}
              </p>
            ) : (
              <p className="mt-5 text-sm text-muted">
                No profile bio has been added yet.
              </p>
            )}
            <div className="mt-6 flex flex-wrap justify-center gap-2 sm:justify-start">
              {user.rhythiaProfile && (
                <a
                  href={user.rhythiaProfile.profileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ui-button border border-white/10 bg-white/5 text-white"
                >
                  <ExternalLink size={16} /> Rhythia profile
                </a>
              )}
              {isOwnProfile && (
                <RhythiaConnect
                  connectedUrl={user.rhythiaProfile?.profileUrl}
                />
              )}
              {!isOwnProfile && (
                <>
                  <FriendButton userId={user.id} />
                  <ProfileBattleButton userId={user.id} />
                  <Link
                    href={`/messages?user=${encodeURIComponent(user.profileHandle)}`}
                    className="ui-button border border-white/10 bg-white/5 text-white"
                  >
                    <MessageCircle size={16} /> Message
                  </Link>
                </>
              )}
              {currentUser && !isOwnProfile && (
                <ReportButton
                  targetType="user"
                  targetId={user.id}
                  targetLabel={user.username}
                />
              )}
            </div>
            {isOwnProfile && referralProgress && (
              <div className="mt-6 border-t border-white/10 pt-5">
                <ProfileShare
                  userId={user.id}
                  progress={referralProgress.count}
                  earned={referralProgress.earned}
                />
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="grid items-stretch gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-accent/20 bg-accent/10 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
                      Total RHP
                    </p>
                    <p className="mt-2 text-4xl font-bold tabular-nums text-white">
                      {displayRhp.toLocaleString()}
                    </p>
                    <p
                      className="mt-1 text-sm font-semibold"
                      style={{ color: mainRank.color }}
                    >
                      {mainRank.isExpert
                        ? "Expert"
                        : `${mainRank.name} ${mainRank.tier}`}
                    </p>
                  </div>
                  <RankIcon rank={mainRank} size={56} />
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
                  <span className="text-xs text-muted">Global position</span>
                  <span className="text-sm font-semibold text-white">
                    {globalRank != null
                      ? `#${globalRank.toLocaleString()}`
                      : "—"}
                  </span>
                </div>
              </div>
              <Suspense
                fallback={
                  <div className="ui-panel min-h-48" role="status">
                    Loading battle rating…
                  </div>
                }
              >
                <RbpProfileCard userId={user.id} className="min-w-0" />
              </Suspense>
              <div className="rounded-3xl border border-violet-400/15 bg-violet-400/[0.06] p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300">
                      Challenge
                    </p>
                    <p className="mt-2 text-4xl font-bold text-white">
                      {challengeLevel ?? "—"}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-violet-200">
                      {favoriteCategory
                        ? CATEGORY_LABELS[favoriteCategory]
                        : "No favorite selected"}
                    </p>
                  </div>
                  <Sparkles size={24} className="text-violet-300" />
                </div>
                <div className="mt-4 border-t border-white/10 pt-3 text-xs text-muted">
                  {favoriteCategory
                    ? "Current level in this player’s favorite challenge category."
                    : isOwnProfile
                      ? "Choose a favorite category below to feature its level here."
                      : "This player hasn’t selected a favorite challenge category."}
                </div>
              </div>
            </div>

            <section className="rounded-3xl border border-white/10 bg-black/15 p-4 sm:p-5">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
                    Game mode ranks
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    Your progress across Lock, Spin, and VR.
                  </p>
                </div>
                <div className="text-xs text-muted">
                  {modeSnapshot?.warning ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-amber-200">
                      <ShieldCheck size={12} /> Showing saved values
                    </span>
                  ) : modeSnapshot?.syncedAt ? (
                    `Last synced ${modeSnapshot.syncedAt.toLocaleString()}`
                  ) : user.rhythiaProfile ? (
                    "Saved mode data"
                  ) : (
                    "Link Rhythia to sync"
                  )}
                </div>
              </div>
              <ModeRankCards points={modePoints} />
              {modeSnapshot?.warning && (
                <p className="mt-3 rounded-2xl border border-amber-400/15 bg-amber-400/[0.05] px-4 py-3 text-xs leading-5 text-amber-100">
                  Rhythia could not be refreshed right now, so your last saved
                  RPL/RPS/RPV values are being shown instead of incorrectly
                  displaying zero.
                </p>
              )}
            </section>
          </div>
        </div>
      </section>

      <nav
        aria-label="Profile sections"
        className="flex flex-wrap justify-center gap-2 sm:justify-start"
      >
        {[
          ["#challenges", "Challenge levels"],
          ["#scores", "Scores"],
          ["#clips", "Clips"],
        ].map(([href, label]) => (
          <a
            key={href}
            href={href}
            className="ui-button border border-border bg-white/5 text-muted hover:text-white"
          >
            {label}
          </a>
        ))}
      </nav>

      {isOwnProfile && (
        <ProfileTagEditor
          initialFavoriteCategory={favoriteCategory ?? ""}
          tags={editableTags.map((entry) => ({
            id: entry.tagId,
            name: entry.tag.name,
            slug: entry.tag.slug,
          }))}
          selected={editableSelectedTagIds}
        />
      )}
      <section
        id="challenges"
        className="scroll-mt-28 rounded-[2rem] border border-border bg-surface/95 p-5 shadow-glow sm:p-7"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-accent">
              Challenge categories
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Skill category levels
            </h2>
          </div>
          <Link
            href="/categories"
            className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent/20"
          >
            View categories
          </Link>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {categoryLevels.map(({ category, level }) => (
            <div
              key={category}
              className={`rounded-2xl border p-4 text-center ${category === favoriteCategory ? "border-violet-400/40 bg-violet-400/10" : "border-white/10 bg-black/15"}`}
            >
              <p className="text-xs uppercase tracking-[0.18em] text-muted">
                {CATEGORY_LABELS[category]}
                {category === favoriteCategory && (
                  <span className="mt-1 block text-violet-300">Favorite</span>
                )}
              </p>
              <p className="mt-2 text-2xl font-bold text-white">
                Level {level}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div id="scores" className="scroll-mt-28 space-y-6">
        {user.rhythiaProfile && <RhythiaStats profile={user.rhythiaProfile} />}
        <Suspense
          fallback={
            <div className="ui-panel" role="status">
              Loading recent scores…
            </div>
          }
        >
          <RhythKitRecentCompletions userId={user.id} />
        </Suspense>
      </div>

      <section id="clips" className="scroll-mt-28 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-accent">
              Clips
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-white">
              Approved clips from this creator
            </h2>
          </div>
          <p className="text-sm text-muted">
            {user.clips.length} approved clip
            {user.clips.length === 1 ? "" : "s"}
          </p>
        </div>
        {user.clips.length === 0 ? (
          <div className="rounded-3xl border border-border bg-background/80 p-8 text-sm text-muted">
            No approved clips are visible yet.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {user.clips.map((clip) => (
              <Link
                key={clip.id}
                href={`/clips/${clip.id}`}
                className="overflow-hidden rounded-3xl border border-border bg-surface/95 p-5 transition hover:-translate-y-0.5 hover:border-accent/40"
              >
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-accent">
                    {clip.category?.name ?? "Uncategorized"}
                  </p>
                  <h3 className="mt-3 text-lg font-semibold text-white">
                    {clip.title}
                  </h3>
                  {clip.reviewedBy && (
                    <p className="mt-2 text-xs text-muted">
                      Approved by{" "}
                      <span className="font-semibold text-white">
                        {clip.reviewedBy.displayName ??
                          clip.reviewedBy.username}
                      </span>
                    </p>
                  )}
                  <p className="mt-2 text-sm text-muted">
                    {clip.createdAt.toLocaleDateString()}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
