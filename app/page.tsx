import Link from "next/link";
import { ArrowRight, CalendarDays, Clock3, Link2, Lock, Megaphone, Sparkles, Trophy, Users, Video } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getOnlineUserCount } from "@/lib/rhythia-status";
import { WelcomeModal } from "@/components/welcome-modal";
import { HomePathNotice } from "@/components/home-path-notice";
import { HomeDailySection } from "@/components/daily/home-daily-section";
import { HomeLeaderboardSection } from "@/components/daily/home-leaderboard-section";
import { getRankInfo, RANKS } from "@/lib/ranks";
import { getUserPathRank } from "@/lib/seasonal-path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getStats() {
  const [members, maps, online] = await Promise.allSettled([
    prisma.user.count(),
    prisma.challengeMap.count({ where: { status: "approved", isAutoImported: false } }),
    getOnlineUserCount(),
  ]);
  return { members: members.status === "fulfilled" ? members.value : 0, maps: maps.status === "fulfilled" ? maps.value : 0, online: online.status === "fulfilled" ? online.value : 0 };
}

async function getNextScheduledTournament() {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string; name: string; mode: string; scheduledAt: Date }>>(`SELECT id,name,mode,"scheduledAt" FROM "Tournament" WHERE status='scheduled' AND "publishedAt" IS NOT NULL ORDER BY "scheduledAt" ASC LIMIT 1`);
    return rows[0] ?? null;
  } catch { return null; }
}

async function getFeaturedClips() {
  try { return await prisma.clip.findMany({ where: { status: "approved", featuredOrder: { not: null } }, orderBy: { featuredOrder: "asc" }, include: { uploader: { select: { username: true } }, category: { select: { name: true } } } }); }
  catch { return []; }
}

async function getLatestAnnouncements() {
  try { return await prisma.announcement.findMany({ where: { published: true }, orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], take: 4, select: { id: true, title: true, slug: true, content: true, pinned: true, createdAt: true } }); }
  catch { return []; }
}

type RecentUpdate = { id: string; title: string; label: string; href: string; updatedAt: Date };

function getRecentUpdates(): RecentUpdate[] {
  return [
    { id: "ranking-v7", title: "Ranking v7 analyzes both map difficulty and how balanced each ranked pass is across its patterns", label: "Ranking", href: "/wiki/ranking", updatedAt: new Date("2026-09-10T00:30:00-04:00") },
    { id: "settings-live", title: "Community Settings now has live Rhythia ranks, owner updates, external video previews, and safer Spin browsing", label: "Settings", href: "/community-settings", updatedAt: new Date("2026-09-08T22:55:00-04:00") },
    { id: "map-sync", title: "Maps now refresh completions every 30 seconds and show current mode-specific ranks", label: "Maps", href: "/maps", updatedAt: new Date("2026-09-08T22:50:00-04:00") },
    { id: "clip-sources", title: "Clip submission expanded with automatic URL metadata and Medal.tv support", label: "Clips", href: "/clips/submit", updatedAt: new Date("2026-09-08T22:45:00-04:00") },
    { id: "streaming-ui", title: "Streaming now profile cards and Rhythians/Rhythia rank displays were rebuilt", label: "Streaming", href: "/online", updatedAt: new Date("2026-09-08T17:00:00-04:00") },
    { id: "mobile-auth", title: "Mobile install experience and Google sign-in were added", label: "Platform", href: "/mobile", updatedAt: new Date("2026-09-08T12:00:00-04:00") },
  ];
}

function announcementPreview(content: string) { return content.replace(/[#>*_`\[\]()~-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 170); }

function NewsSection({ announcements, updates }: { announcements: Awaited<ReturnType<typeof getLatestAnnouncements>>; updates: RecentUpdate[] }) {
  const featured = announcements[0] ?? null;
  const others = announcements.slice(1);
  return <section className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
    <div className="relative overflow-hidden rounded-[2rem] border border-accent/25 bg-[radial-gradient(circle_at_0%_0%,rgba(124,143,240,0.2),transparent_38%),linear-gradient(145deg,rgba(24,31,51,0.98),rgba(10,14,25,0.98))] p-5 shadow-glow sm:p-7">
      <div className="flex items-center justify-between gap-4"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-accent"><Megaphone size={17} /> Announcements</div><Link href="/announcements" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition hover:text-white">View all <ArrowRight size={13} /></Link></div>
      {featured ? <Link href={`/announcements/${featured.slug}`} className="group mt-5 block rounded-3xl border border-accent/20 bg-accent/[0.08] p-5 transition hover:-translate-y-0.5 hover:border-accent/40 hover:bg-accent/[0.12] sm:p-6"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-accent">{featured.pinned ? "Pinned" : "Latest"}</span><span className="text-xs text-muted">{featured.createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span></div><h2 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-white transition group-hover:text-accent sm:text-3xl">{featured.title}</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-muted">{announcementPreview(featured.content) || "Open the announcement for the full update."}{featured.content.length > 170 ? "…" : ""}</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-accent">Read announcement <ArrowRight size={15} /></span></Link> : <p className="mt-5 rounded-3xl border border-dashed border-border bg-background/60 p-6 text-sm text-muted">No announcements have been published yet.</p>}
      {others.length > 0 && <div className="mt-4 grid gap-3 md:grid-cols-3">{others.map((announcement) => <Link key={announcement.id} href={`/announcements/${announcement.slug}`} className="rounded-2xl border border-white/10 bg-black/15 p-4 transition hover:border-accent/25 hover:bg-white/[0.04]"><p className="line-clamp-2 text-sm font-semibold leading-6 text-white">{announcement.title}</p><p className="mt-2 text-xs text-muted">{announcement.createdAt.toLocaleDateString()}</p></Link>)}</div>}
    </div>
    <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(145deg,rgba(20,27,45,0.97),rgba(8,12,22,0.97))] p-5 shadow-glow sm:p-6">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-emerald-300"><Clock3 size={16} /> Recent website updates</div>
      <p className="mt-2 text-sm leading-6 text-muted">Changes made to Rhythians itself—new systems, fixes, UI improvements, and platform features.</p>
      <div className="mt-5 divide-y divide-white/10">{updates.map((update) => <Link key={update.id} href={update.href} className="group flex items-start gap-3 py-3.5 first:pt-0 last:pb-0"><span className="mt-0.5 shrink-0 rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-300">{update.label}</span><div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-semibold text-white transition group-hover:text-accent">{update.title}</p><p className="mt-1 text-xs text-muted">Updated {update.updatedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p></div><ArrowRight size={14} className="mt-1 shrink-0 text-muted transition group-hover:translate-x-1 group-hover:text-white" /></Link>)}</div>
    </div>
  </section>;
}

export default async function HomePage() {
  const [stats, featuredClips, announcements, nextTournament, user] = await Promise.all([getStats(), getFeaturedClips(), getLatestAnnouncements(), getNextScheduledTournament(), getSessionUser()]);
  const recentUpdates = getRecentUpdates();
  const linkedProfile = user ? await prisma.rhythiaProfile.findUnique({ where: { userId: user.id }, select: { id: true } }).catch(() => null) : null;
  const pathRank = user ? await getUserPathRank(user.id).catch(() => -1) : -1;
  const regularRank = user ? getRankInfo(user.rhp) : null;
  const pathRankInfo = pathRank >= 0 ? getRankInfo(RANKS[Math.min(pathRank, RANKS.length - 1)]?.minRhp ?? 0) : null;
  const tournamentDate = nextTournament ? new Date(nextTournament.scheduledAt) : null;

  return <div className="ui-page space-y-7 sm:space-y-8">
    <WelcomeModal user={Boolean(user)} hasLinkedProfile={Boolean(linkedProfile)} profileHandle={user?.profileHandle ?? null} />
    {user && regularRank && pathRank < regularRank.index && <HomePathNotice regularRank={regularRank} pathRank={pathRankInfo} />}
    <section className="relative overflow-hidden rounded-[2rem] border border-accent/15 bg-[radial-gradient(circle_at_8%_0%,rgba(124,143,240,0.2),transparent_31%),radial-gradient(circle_at_88%_92%,rgba(85,214,160,0.12),transparent_26%),linear-gradient(135deg,rgba(20,27,45,0.98),rgba(8,12,22,0.98))] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.26)] sm:p-8 lg:p-10">
      <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1.22fr)_minmax(390px,0.78fr)] xl:items-stretch"><div className="flex min-h-[360px] flex-col justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent"><Sparkles size={14} /> Rhythians community platform</span><span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1.5 text-xs font-semibold text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {stats.online} online</span></div><h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-[-0.055em] text-white sm:text-5xl lg:text-6xl">The most balanced Rhythia ranking system.</h1><p className="mt-4 max-w-3xl text-base leading-7 text-muted sm:text-lg">Our suggestion box is never left unread.</p></div><div className="mt-8 flex flex-wrap gap-3"><Link href="/maps" className="ui-button bg-accent text-white"><Trophy size={16} /> Explore maps</Link><Link href="/tournaments" className="ui-button border border-white/10 bg-white/5 text-white"><CalendarDays size={16} /> Tournaments</Link>{user && !linkedProfile && <Link href={`/profile/${user.profileHandle}`} className="ui-button border border-amber-400/30 bg-amber-400/10 text-amber-200"><Link2 size={16} /> Link Rhythia</Link>}{!user && <Link href="/login" className="ui-button border border-white/10 bg-white/5 text-white"><Link2 size={16} /> Sign in</Link>}</div></div>
      <div className="grid gap-4 sm:grid-cols-2"><div className="ui-sheen rounded-3xl border border-white/10 bg-white/[0.045] p-5"><p className="ui-kicker text-muted">Members</p><p className="mt-3 text-3xl font-semibold text-white">{stats.members.toLocaleString()}</p></div><div className="ui-sheen rounded-3xl border border-violet-400/15 bg-violet-400/[0.045] p-5"><p className="ui-kicker text-muted">Maps</p><p className="mt-3 text-3xl font-semibold text-white">{stats.maps.toLocaleString()}</p></div><Link href="/tournaments" className="ui-sheen rounded-3xl border border-sky-400/15 bg-sky-400/[0.045] p-5"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Next tournament</p><p className="mt-3 text-xl font-semibold text-white">{nextTournament?.name ?? "No tournament scheduled"}</p>{tournamentDate && <p className="mt-2 text-sm text-sky-200">{tournamentDate.toLocaleDateString()} · {nextTournament?.mode}</p>}</Link><div className="ui-sheen rounded-3xl border border-emerald-400/15 bg-emerald-400/[0.045] p-5"><p className="ui-kicker text-muted">Live</p><p className="mt-3 text-3xl font-semibold text-white">{stats.online.toLocaleString()}</p></div></div></div>
    </section>
    <NewsSection announcements={announcements} updates={recentUpdates} />
    <section className="grid gap-7 lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]"><HomeDailySection /><HomeLeaderboardSection /></section>
    <section className="grid gap-4 md:grid-cols-3"><Link href="/path" className="ui-card ui-card-hover group rounded-3xl p-5"><Trophy className="text-accent" size={22} /><h2 className="mt-4 text-lg font-semibold text-white">Seasonal Path</h2><p className="mt-2 text-sm text-muted">Progress through seasonal ranks and verify each path map.</p></Link><Link href="/clips" className="ui-card ui-card-hover rounded-3xl p-5"><Video className="text-sky-300" size={22} /><h2 className="mt-4 text-lg font-semibold text-white">Community Clips</h2><p className="mt-2 text-sm text-muted">Watch highlights, share runs, and discover creators.</p></Link><Link href="/community-settings" className="ui-card ui-card-hover rounded-3xl p-5"><Users className="text-emerald-300" size={22} /><h2 className="mt-4 text-lg font-semibold text-white">Community Settings</h2><p className="mt-2 text-sm text-muted">Compare live-ranked player settings and gameplay previews.</p></Link></section>
    <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(167,139,250,0.07),rgba(20,27,45,0.92))] p-5 shadow-glow sm:p-6"><div className="flex items-center justify-between"><p className="text-sm uppercase tracking-[0.24em] text-violet-300">Featured clips</p><Link href="/clips" className="text-xs text-muted hover:text-white">Browse all</Link></div><div className="mt-5 grid gap-4 md:grid-cols-2">{featuredClips.length ? featuredClips.map((clip) => <Link key={clip.id} href={`/clips/${clip.id}`} className="rounded-3xl border border-white/10 bg-black/20 p-5"><p className="text-xs uppercase tracking-[0.2em] text-violet-300">{clip.category?.name ?? "Clip"}</p><h3 className="mt-2 text-lg font-semibold text-white">{clip.title}</h3><p className="mt-2 text-sm text-muted">By {clip.uploader.username}</p></Link>) : <p className="text-sm text-muted">No featured clips selected yet.</p>}</div></section>
    <section className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-black/10 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="ui-kicker text-muted">Rhythians Desktop</p><p className="mt-1 text-sm text-white/70">Downloads are temporarily locked while the desktop release is being prepared.</p></div><div className="ui-button cursor-not-allowed border border-white/10 bg-white/5 text-muted/60"><Lock size={16} /> Download locked</div></section>
  </div>;
}
