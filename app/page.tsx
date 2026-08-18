import Link from "next/link";
import { ArrowRight, Sparkles, MessageCircle, BookOpen, Video, Link2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getPublishedArticleCount } from "@/lib/knowledge";
import { getOnlineUserCount } from "@/lib/rhythia-status";
import { WelcomeModal } from "@/components/welcome-modal";
import { HomeDailySection } from "@/components/daily/home-daily-section";
import { HomeLeaderboardSection } from "@/components/daily/home-leaderboard-section";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getStats() {
  try {
    const [members, clips, online] = await Promise.all([
      prisma.user.count(),
      prisma.clip.count({ where: { status: "approved" } }),
      getOnlineUserCount(),
    ]);
    return { members, articles: getPublishedArticleCount(), clips, online };
  } catch (error) {
    console.error("Homepage stats unavailable:", error);
    return { members: 0, articles: 0, clips: 0, online: 0 };
  }
}

async function getFeaturedClips() {
  try {
    return await prisma.clip.findMany({
      where: { status: "approved", featuredOrder: { not: null } },
      orderBy: { featuredOrder: "asc" },
      include: { uploader: { select: { username: true } }, category: { select: { name: true } } },
    });
  } catch (error) {
    console.error("Featured clips unavailable:", error);
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
  } catch (error) {
    console.error("Announcements unavailable:", error);
    return [];
  }
}

export default async function HomePage() {
  const stats = await getStats();
  const featuredClips = await getFeaturedClips();
  const announcements = await getLatestAnnouncements();
  const user = await getSessionUser();
  const linkedProfile = user
    ? await prisma.rhythiaProfile.findUnique({ where: { userId: user.id }, select: { id: true } }).catch(() => null)
    : null;

  return (
    <div className="space-y-10">
      <WelcomeModal user={Boolean(user)} hasLinkedProfile={Boolean(linkedProfile)} profileHandle={user?.profileHandle ?? null} />
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-sm font-medium text-accent">
              Community platform for Discord creators
            </span>
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">Welcome to Rhythians</h1>
              <p className="max-w-2xl text-lg leading-8 text-muted">A polished home for your Discord community with knowledge, clips, rules, announcements, ranked maps, and member media.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/community" className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent2">Join Discord</Link>
              <Link href="/wiki" className="inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-5 py-3 text-sm text-white transition hover:border-accent/40">Explore Wiki</Link>
              {user && !linkedProfile && (
                <Link href={`/profile/${user.profileHandle}`} className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-5 py-3 text-sm font-semibold text-amber-200 transition hover:bg-amber-400/20">
                  <Link2 size={16} /> Link your Rhythia account
                </Link>
              )}
              {!user && (
                <Link href="/login" className="inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-5 py-3 text-sm text-white transition hover:border-accent/40">
                  <Link2 size={16} /> Sign in to play
                </Link>
              )}
            </div>
          </div>
          <div className="rounded-3xl border border-border bg-background/80 p-6 text-sm text-muted shadow-inner">
            <div className="rounded-3xl border border-white/5 bg-gradient-to-b from-white/5 to-transparent p-6">
              <p className="text-sm uppercase tracking-[0.24em] text-accent">Server snapshot</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-border bg-surface p-5">
                  <p className="text-sm text-muted">Members</p>
                  <p className="mt-2 text-3xl font-semibold">{stats.members}</p>
                </div>
                <div className="rounded-3xl border border-border bg-surface p-5">
                  <p className="text-sm text-muted">Online</p>
                  <p className="mt-2 text-3xl font-semibold">{stats.online}</p>
                </div>
                <div className="rounded-3xl border border-border bg-surface p-5">
                  <p className="text-sm text-muted">Articles</p>
                  <p className="mt-2 text-3xl font-semibold">{stats.articles}</p>
                </div>
                <div className="rounded-3xl border border-border bg-surface p-5">
                  <p className="text-sm text-muted">Clips</p>
                  <p className="mt-2 text-3xl font-semibold">{stats.clips}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <HomeDailySection />
        <HomeLeaderboardSection />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <article className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <BookOpen size={24} />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-white">Wiki</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Explore the wiki, guides, FAQs, and resources curated for the community.</p>
          <Link href="/wiki" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-accent transition hover:text-white">
            View articles <ArrowRight size={16} />
          </Link>
        </article>
        <article className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <Video size={24} />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-white">Clips</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Submit and browse community clips with likes, comments, and moderation support.</p>
          <Link href="/clips" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-accent transition hover:text-white">
            Browse clips <ArrowRight size={16} />
          </Link>
        </article>
        <article className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <Sparkles size={24} />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-white">Community</h2>
          <p className="mt-2 text-sm leading-6 text-muted">A home for permanent content that complements Discord discussions and events.</p>
          <Link href="/community" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-accent transition hover:text-white">
            See community <ArrowRight size={16} />
          </Link>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
          <div className="flex items-center gap-3 text-sm uppercase tracking-[0.24em] text-accent">
            <Sparkles /> Featured Clips
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {featuredClips.length > 0 ? (
              featuredClips.map((clip) => (
                <Link
                  key={clip.id}
                  href={`/clips/${clip.id}`}
                  className="group overflow-hidden rounded-3xl border border-border bg-background/90 transition hover:-translate-y-0.5 hover:shadow-glow"
                >
                  <div className="aspect-video bg-white/5" />
                  <div className="p-5">
                    <p className="text-xs uppercase tracking-[0.24em] text-accent">{clip.category?.name ?? "Clip"}</p>
                    <h3 className="mt-2 text-lg font-semibold text-white">{clip.title}</h3>
                    <p className="mt-2 text-sm text-muted">By {clip.uploader.username}</p>
                  </div>
                </Link>
              ))
            ) : (
              <p className="rounded-3xl border border-border bg-background/90 p-6 text-sm text-muted">
                No featured clips have been selected yet.
              </p>
            )}
          </div>
        </div>
        <div className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
          <div className="flex items-center gap-3 text-sm uppercase tracking-[0.24em] text-accent">
            <MessageCircle /> Latest announcements
          </div>
          <div className="mt-6 space-y-4">
            {announcements.length > 0 ? (
              announcements.map((announcement) => (
                <Link
                  key={announcement.id}
                  href={`/announcements/${announcement.slug}`}
                  className="block rounded-3xl border border-border bg-background/80 p-5 transition hover:border-accent/40"
                >
                  <p className="text-sm font-semibold text-white">{announcement.title}</p>
                  <p className="mt-2 text-sm text-muted">{new Date(announcement.createdAt).toLocaleDateString()}</p>
                </Link>
              ))
            ) : (
              <p className="rounded-3xl border border-border bg-background/80 p-5 text-sm text-muted">
                No announcements yet.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
