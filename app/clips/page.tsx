import Link from "next/link";
import { prisma } from "@/lib/db";
import { getThumbnailUrl } from "@/lib/clips";
import { cameraModeLabel, cameraModeEmoji } from "@/lib/camera-mode";
import { Music, Tag as TagIcon } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ClipsPage({
  searchParams,
}: {
  searchParams: Promise<{ song?: string; tag?: string }>;
}) {
  const params = await searchParams;
  const song = typeof params?.song === "string" ? params.song.trim() : "";
  const tag = typeof params?.tag === "string" ? params.tag.trim() : "";

  const where: Record<string, unknown> = { status: "approved" };
  if (song) where.songName = { contains: song, mode: "insensitive" };
  if (tag) where.tags = { some: { tag: { slug: tag } } };

  const clips = await prisma.clip.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      uploader: true,
      category: true,
      reviewedBy: { select: { username: true, discriminator: true, displayName: true } },
      tags: { include: { tag: true } },
    },
    take: 12,
  });

  const clipsWithThumbs = await Promise.all(
    clips.map(async (clip) => ({
      ...clip,
      thumbnailUrl: await getThumbnailUrl(clip.thumbnailPath),
    }))
  );

  const filterLabel = song ? `filtered by song "${song}"` : tag ? `filtered by tag "${tag}"` : "";

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
              {filterLabel && <span className="text-white"> {filterLabel}.</span>}
            </p>
            {(song || tag) && (
              <Link href="/clips" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:text-white">
                Clear filter
              </Link>
            )}
          </div>
          <Link
            href="/clips/submit"
            className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent2"
          >
            Submit a clip
          </Link>
        </div>
      </section>

      {clipsWithThumbs.length === 0 ? (
        <div className="rounded-3xl border border-border bg-background/80 p-8 text-sm text-muted">
          {song || tag ? "No clips match that filter yet." : "No approved clips are available yet."}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {clipsWithThumbs.map((clip) => {
            const modeLabel = cameraModeLabel(clip.cameraMode);
            const modeEmoji = cameraModeEmoji(clip.cameraMode);
            return (
              <Link
                key={clip.id}
                href={`/clips/${clip.id}`}
                className="group overflow-hidden rounded-3xl border border-border bg-surface/95 shadow-glow transition hover:-translate-y-1 hover:border-accent/40 hover:shadow-glow"
              >
                <div className="relative aspect-video overflow-hidden bg-white/5">
                  {clip.thumbnailUrl ? (
                    <img
                      src={clip.thumbnailUrl}
                      alt={clip.title}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted">
                      No thumbnail
                    </div>
                  )}
                  {modeLabel && (
                    <span className="absolute left-3 top-3 rounded-full border border-accent/30 bg-background/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-accent backdrop-blur">
                      {modeEmoji} {modeLabel}
                    </span>
                  )}
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.24em] text-accent">
                    <span>{clip.category?.name ?? "Uncategorized"}</span>
                    <span>{clip.uploader.username}</span>
                  </div>
                  <h2 className="mt-4 text-lg font-semibold text-white">
                    {clip.title}
                  </h2>
                  {clip.songName && (
                    <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">
                      <Music size={12} /> {clip.songName}
                    </p>
                  )}
                  {clip.tags.length > 0 && (
                    <p className="mt-2 flex flex-wrap gap-1.5">
                      {clip.tags.slice(0, 3).map(({ tag }) => (
                        <span key={tag.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-background/60 px-2 py-0.5 text-[11px] font-medium text-muted">
                          <TagIcon className="h-3 w-3" /> {tag.name}
                        </span>
                      ))}
                    </p>
                  )}
                  {clip.reviewedBy && (
                    <p className="mt-2 text-xs text-muted">
                      Approved by <span className="font-semibold text-white">{clip.reviewedBy.displayName ?? clip.reviewedBy.username}</span>
                    </p>
                  )}
                  <p className="mt-3 text-sm text-muted">
                    {clip.createdAt.toLocaleDateString()}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}