import { prisma } from "@/lib/db";
import { FeaturedClipsManager } from "@/components/featured-clips-manager";

export const dynamic = "force-dynamic";

export default async function AdminFeaturedClipsPage() {
  const clips = await prisma.clip.findMany({
    where: { status: "approved" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      createdAt: true,
      featuredOrder: true,
      uploader: { select: { username: true, discriminator: true } },
      category: { select: { name: true } },
    },
  });

  const featured = clips.filter((clip) => clip.featuredOrder !== null);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-accent">Featured clips</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">Choose two clips for the spotlight</h1>
            <p className="mt-3 text-sm leading-7 text-muted">
              Pick two approved clips to highlight on the home page. Save to apply your changes.
            </p>
          </div>
        </div>
      </section>
      <FeaturedClipsManager
        initialClips={clips.map((clip) => ({
          id: clip.id,
          title: clip.title,
          createdAt: clip.createdAt.toISOString(),
          featuredOrder: clip.featuredOrder,
          uploader: clip.uploader,
          category: clip.category,
        }))}
        initialFeatured={featured
          .sort((a, b) => (a.featuredOrder ?? 0) - (b.featuredOrder ?? 0))
          .map((clip) => clip.id)}
      />
    </div>
  );
}
