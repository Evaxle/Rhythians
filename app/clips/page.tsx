import Link from "next/link";
import { prisma } from "@/lib/db";
import { getThumbnailUrl } from "@/lib/clips";
import { cameraModeLabel, cameraModeEmoji } from "@/lib/camera-mode";

export const dynamic = "force-dynamic";

export default async function ClipsPage() {
  const clips = await prisma.clip.findMany({
    where: { status: "approved" },
    orderBy: { createdAt: "desc" },
    include: { uploader: true, category: true },
    take: 12,
  });

  const clipsWithThumbs = await Promise.all(
    clips.map(async (clip) => ({
      ...clip,
      thumbnailUrl: await getThumbnailUrl(clip.thumbnailPath),
    }))
  );

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

      {clipsWithThumbs.length === 0 ? (
        <div className="rounded-3xl border border-border bg-background/80 p-8 text-sm text-muted">
          No approved clips are available yet.
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
