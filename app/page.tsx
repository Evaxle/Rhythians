import Link from "next/link";
import { ArrowRight, Sparkles, MessageCircle, BookOpen, Video, Globe } from "lucide-react";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getStats() {
  const [members, articles, clips] = await Promise.all([
    prisma.user.count(),
    prisma.knowledgeArticle.count({ where: { published: true } }),
    prisma.clip.count({ where: { status: "approved" } }),
  ]);
  return { members, articles, clips, online: undefined };
}

async function getFeaturedClips() {
  return prisma.clip.findMany({
    where: { status: "approved", featuredOrder: { not: null } },
    orderBy: { featuredOrder: "asc" },
    include: { uploader: { select: { username: true } }, category: { select: { name: true } } },
  });
}

async function getLatestAnnouncements() {
  return prisma.announcement.findMany({
    where: { published: true },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 3,
    select: { id: true, title: true, slug: true, createdAt: true },
  });
}

export default async function HomePage() {
  const stats = await getStats();
  const featuredClips = await getFeaturedClips();
  const announcements = await getLatestAnnouncements();

  return (
    <div className="space-y-10">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-sm font-medium text-accent">
              Community platform for Discord creators
            </span>
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">Welcome to Rhythians</h1>
              <p className="max-w-2xl text-lg leading-8 text-muted">A polished home for your Discord community with knowledge, clips, rules, announcements, and member media.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/community" className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent2">Join Discord</Link>
              <Link href="/knowledge" className="inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-5 py-3 text-sm text-white transition hover:border-accent/40">Explore Knowledge</Link>
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
                  <p className="mt-2 text-3xl font-semibold">{stats.online ?? "—"}</p>
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

      <section className="grid gap-6 lg:grid-cols-3">
        <article className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <BookOpen size={24} />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-white">Knowledge</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Explore the wiki, guides, FAQs, and resources curated for the community.</p>
          <Link href="/knowledge" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-accent transition hover:text-white">
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
