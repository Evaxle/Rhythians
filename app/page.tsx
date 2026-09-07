import Link from "next/link";
import { ArrowRight, CalendarDays, Sparkles, MessageCircle, Video, Link2, Lock, Trophy, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getOnlineUserCount } from "@/lib/rhythia-status";
import { WelcomeModal } from "@/components/welcome-modal";
import { HomePathNotice } from "@/components/home-path-notice";
import { HomeDailySection } from "@/components/daily/home-daily-section";
import { HomeLeaderboardSection } from "@/components/daily/home-leaderboard-section";
import { getRankInfo } from "@/lib/ranks";
import { getUserPathRank } from "@/lib/seasonal-path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getStats() {
  const [members, maps, online] = await Promise.allSettled([
    prisma.user.count(),
    prisma.challengeMap.count({ where: { status: "approved", isAutoImported: false } }),
    getOnlineUserCount(),
  ]);
  return {
    members: members.status === "fulfilled" ? members.value : 0,
    maps: maps.status === "fulfilled" ? maps.value : 0,
    online: online.status === "fulfilled" ? online.value : 0,
  };
}

async function getNextScheduledTournament() {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string; name: string; mode: string; scheduledAt: Date }>>(
      `SELECT id,name,mode,"scheduledAt" FROM "Tournament" WHERE status='scheduled' AND "publishedAt" IS NOT NULL ORDER BY "scheduledAt" ASC LIMIT 1`,
    );
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

async function getFeaturedClips() {
  try {
    return await prisma.clip.findMany({
      where: { status: "approved", featuredOrder: { not: null } },
      orderBy: { featuredOrder: "asc" },
      include: { uploader: { select: { username: true } }, category: { select: { name: true } } },
    });
  } catch {
    return [];
  }
}

async function getLatestAnnouncements() {
  try {
    return await prisma.announcement.findMany({
      where: { published: true },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 3,
      select: { id: true, title: true, slug: true, createdAt: true },
    });
  } catch {
    return [];
  }
}

function AnnouncementsSection({ announcements }: { announcements: Awaited<ReturnType<typeof getLatestAnnouncements>> }) {
  return (
    <section className="ui-card ui-glow rounded-[2rem] p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-sm uppercase tracking-[0.24em] text-accent"><MessageCircle size={18} /> Latest announcements</div>
        <Link href="/announcements" className="text-xs font-semibold text-muted transition hover:text-white">View all</Link>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {announcements.length > 0 ? announcements.map((announcement, index) => (
          <Link key={announcement.id} href={`/announcements/${announcement.slug}`} className={`group rounded-2xl border p-4 transition hover:-translate-y-0.5 ${index === 0 ? "border-accent/25 bg-accent/10" : index === 1 ? "border-violet-400/20 bg-violet-400/[0.06]" : "border-emerald-400/20 bg-emerald-400/[0.05]"}`}>
            <p className="text-sm font-semibold text-white transition group-hover:text-accent">{announcement.title}</p>
            <p className="mt-2 text-xs text-muted">{new Date(announcement.createdAt).toLocaleDateString()}</p>
          </Link>
        )) : <p className="rounded-2xl border border-border bg-background/70 p-4 text-sm text-muted md:col-span-3">No announcements yet.</p>}
      </div>
    </section>
  );
}

export default async function HomePage() {
  const [stats, featuredClips, announcements, nextTournament, user] = await Promise.all([
    getStats(),
    getFeaturedClips(),
    getLatestAnnouncements(),
    getNextScheduledTournament(),
    getSessionUser(),
  ]);
  const linkedProfile = user ? await prisma.rhythiaProfile.findUnique({ where: { userId: user.id }, select: { id: true } }).catch(() => null) : null;
  const pathRank = user ? await getUserPathRank(user.id).catch(() => -1) : -1;
  const regularRank = user ? getRankInfo(user.rhp) : null;
  const pathRankInfo = pathRank >= 0 ? getRankInfo(pathRank * 500) : null;
  const tournamentDate = nextTournament ? new Date(nextTournament.scheduledAt) : null;

  return (
    <div className="ui-page space-y-7 sm:space-y-8">
      <WelcomeModal user={Boolean(user)} hasLinkedProfile={Boolean(linkedProfile)} profileHandle={user?.profileHandle ?? null} />
      {user && regularRank && pathRank < regularRank.index && <HomePathNotice regularRank={regularRank} pathRank={pathRankInfo} />}
      <section className="relative overflow-hidden rounded-[2rem] border border-accent/15 bg-[radial-gradient(circle_at_8%_0%,rgba(124,143,240,0.2),transparent_31%),radial-gradient(circle_at_88%_92%,rgba(85,214,160,0.12),transparent_26%),linear-gradient(135deg,rgba(20,27,45,0.98),rgba(8,12,22,0.98))] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.26)] sm:p-8 lg:p-10">
        <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1.22fr)_minmax(390px,0.78fr)] xl:items-stretch">
          <div className="flex min-h-[360px] flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent"><Sparkles size={14} /> Rhythians community platform</span>
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1.5 text-xs font-semibold text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {stats.online} online</span>
              </div>
              <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-[-0.055em] text-white sm:text-5xl lg:text-6xl">Everything for your Rhythia journey.</h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-muted sm:text-lg">Maps, progression, challenges, clips, battles, announcements, and community tools in one polished home.</p>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/maps" className="ui-button bg-accent text-white shadow-lg shadow-accent/15 hover:bg-accent2"><Trophy size={16} /> Explore maps</Link>
              <Link href="/battles" className="ui-button border border-white/10 bg-white/5 text-white hover:border-accent/30 hover:bg-white/10"><Sparkles size={16} /> Enter battles</Link>
              {user && !linkedProfile && <Link href={`/profile/${user.profileHandle}`} className="ui-button border border-amber-400/30 bg-amber-400/10 text-amber-200 hover:bg-amber-400/15"><Link2 size={16} /> Link Rhythia</Link>}
              {!user && <Link href="/login" className="ui-button border border-white/10 bg-white/5 text-white hover:border-accent/30"><Link2 size={16} /> Sign in</Link>}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="ui-sheen rounded-3xl border border-white/10 bg-white/[0.045] p-5"><p className="ui-kicker text-muted">Members</p><p className="mt-3 text-3xl font-semibold text-white">{stats.members.toLocaleString()}</p><p className="mt-1 text-xs text-muted">Community accounts</p></div>
            <div className="ui-sheen rounded-3xl border border-violet-400/15 bg-violet-400/[0.045] p-5"><p className="ui-kicker text-muted">Maps</p><p className="mt-3 text-3xl font-semibold text-white">{stats.maps.toLocaleString()}</p><p className="mt-1 text-xs text-violet-300">Approved community maps</p></div>
            <Link href="/tournaments" className="ui-sheen group rounded-3xl border border-sky-400/15 bg-sky-400/[0.045] p-5 transition hover:-translate-y-0.5 hover:border-sky-300/30"><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted"><CalendarDays size={14} className="text-sky-300" /> Next tournament</p><p className="mt-3 line-clamp-2 text-xl font-semibold leading-tight text-white transition group-hover:text-sky-100">{nextTournament?.name ?? "No tournament scheduled"}</p>{tournamentDate ? <><p className="mt-2 text-sm font-semibold text-sky-200">{tournamentDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p><p className="mt-1 text-xs text-muted">{tournamentDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} · {nextTournament?.mode}</p></> : <p className="mt-2 text-xs text-sky-300">Check back for the next signup window.</p>}</Link>
            <div className="ui-sheen rounded-3xl border border-emerald-400/15 bg-emerald-400/[0.045] p-5"><p className="ui-kicker text-muted">Live</p><p className="mt-3 text-3xl font-semibold text-white">{stats.online.toLocaleString()}</p><p className="mt-1 text-xs text-emerald-300">Rhythia presence</p></div>
          </div>
        </div>
      </section>
      <AnnouncementsSection announcements={announcements} />
      <section className="grid gap-7 lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]"><HomeDailySection /><HomeLeaderboardSection /></section>
      <section className="grid gap-4 md:grid-cols-3">
        <Link href="/path" className="ui-card ui-card-hover group rounded-3xl p-5"><div className="flex items-center justify-between"><span className="rounded-2xl bg-accent/10 p-3 text-accent"><Trophy size={22} /></span><ArrowRight className="text-muted transition group-hover:translate-x-1 group-hover:text-white" size={18} /></div><h2 className="mt-4 text-lg font-semibold text-white">Seasonal Path</h2><p className="mt-2 text-sm leading-6 text-muted">Progress through seasonal ranks and verify each path map.</p></Link>
        <Link href="/clips" className="ui-card ui-card-hover group rounded-3xl border-sky-400/10 bg-[linear-gradient(145deg,rgba(56,189,248,0.06),rgba(12,17,29,0.94))] p-5"><div className="flex items-center justify-between"><span className="rounded-2xl bg-sky-400/10 p-3 text-sky-300"><Video size={22} /></span><ArrowRight className="text-muted transition group-hover:translate-x-1 group-hover:text-white" size={18} /></div><h2 className="mt-4 text-lg font-semibold text-white">Community Clips</h2><p className="mt-2 text-sm leading-6 text-muted">Watch highlights, share runs, and discover creators.</p></Link>
        <Link href="/community-settings" className="ui-card ui-card-hover group rounded-3xl border-emerald-400/10 bg-[linear-gradient(145deg,rgba(85,214,160,0.06),rgba(12,17,29,0.94))] p-5"><div className="flex items-center justify-between"><span className="rounded-2xl bg-emerald-400/10 p-3 text-emerald-300"><Users size={22} /></span><ArrowRight className="text-muted transition group-hover:translate-x-1 group-hover:text-white" size={18} /></div><h2 className="mt-4 text-lg font-semibold text-white">Community Settings</h2><p className="mt-2 text-sm leading-6 text-muted">Manage community preferences and connected community tools.</p></Link>
      </section>
      <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(167,139,250,0.07),rgba(20,27,45,0.92))] p-5 shadow-glow sm:p-6"><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3 text-sm uppercase tracking-[0.24em] text-violet-300"><Sparkles size={17} /> Featured clips</div><Link href="/clips" className="text-xs font-semibold text-muted hover:text-white">Browse all</Link></div><div className="mt-5 grid gap-4 md:grid-cols-2">{featuredClips.length > 0 ? featuredClips.map((clip) => <Link key={clip.id} href={`/clips/${clip.id}`} className="group grid overflow-hidden rounded-3xl border border-white/10 bg-black/20 transition hover:-translate-y-1 hover:border-violet-300/20 hover:shadow-2xl md:grid-cols-[220px_1fr]"><div className="aspect-video bg-white/5 md:aspect-auto" /><div className="p-5"><p className="text-xs uppercase tracking-[0.2em] text-violet-300">{clip.category?.name ?? "Clip"}</p><h3 className="mt-2 text-lg font-semibold text-white transition group-hover:text-violet-200">{clip.title}</h3><p className="mt-2 text-sm text-muted">By {clip.uploader.username}</p></div></Link>) : <p className="rounded-3xl border border-white/10 bg-black/20 p-6 text-sm text-muted md:col-span-2">No featured clips have been selected yet.</p>}</div></section>
      <section className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-black/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div><p className="ui-kicker text-muted">Rhythians Desktop</p><p className="mt-1 text-sm text-white/70">RhythKit and Rhythians Desktop downloads are temporarily locked while the desktop release is being prepared.</p></div><div className="ui-button shrink-0 cursor-not-allowed border border-white/10 bg-white/5 text-muted/60"><Lock size={16} /> Download locked</div></section>
    </div>
  );
}
