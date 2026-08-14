import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ClipsPage() {
  const clips = await prisma.clip.findMany({
    where: { status: "approved" },
    orderBy: { createdAt: "desc" },
    include: { uploader: true, category: true },
    take: 12,
  });

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-accent">Clips</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">
              Browse community clips
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
              Watch the latest approved submissions from the community.
            </p>
          </div>
          <Link
            href="/clips/submit"
            className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent2"
          >
            Submit a clip
          </Link>
        </div>
      </section>

      {clips.length === 0 ? (
        <div className="rounded-3xl border border-border bg-background/80 p-8 text-sm text-muted">
          No approved clips are available yet.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {clips.map(
            (clip: {
              id: string;
              title: string;
              createdAt: Date;
              uploader: {
                username: string;
              };
              category: {
                name: string;
              } | null;
            }) => (
              <Link
                key={clip.id}
                href={`/clips/${clip.id}`}
                className="overflow-hidden rounded-3xl border border-border bg-surface/95 shadow-glow transition hover:-translate-y-0.5 hover:border-accent/40"
              >
                <div className="aspect-video bg-white/5" />
                <div className="p-5">
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.24em] text-accent">
                    <span>{clip.category?.name ?? "Uncategorized"}</span>
                    <span>{clip.uploader.username}</span>
                  </div>
                  <h2 className="mt-4 text-lg font-semibold text-white">
                    {clip.title}
                  </h2>
                  <p className="mt-3 text-sm text-muted">
                    {clip.createdAt.toLocaleDateString()}
                  </p>
                </div>
              </Link>
            )
          )}
        </div>
      )}
    </div>
  );
}