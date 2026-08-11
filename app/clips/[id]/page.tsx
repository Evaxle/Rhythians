import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";

type Props = {
  params: { id: string };
};

async function getPublicUrl(path: string) {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.storage.from(process.env.STORAGE_BUCKET ?? "media").createSignedUrl(path, 60);
  if (error || !data) return null;
  return data.signedUrl;
}

export default async function ClipPage({ params }: Props) {
  const clip = await prisma.clip.findUnique({
    where: { id: params.id },
    include: { uploader: true, category: true, tags: { include: { tag: true } }, comments: { orderBy: { createdAt: "desc" }, include: { author: true } }, likes: true },
  });

  if (!clip || clip.status !== "approved") {
    return notFound();
  }

  const videoUrl = await getPublicUrl(clip.storagePath);

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-border bg-surface/95 shadow-glow">
        <div className="aspect-video bg-black">
          {videoUrl ? (
            <video controls className="h-full w-full object-cover" src={videoUrl} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted">Video preview is unavailable.</div>
          )}
        </div>
      </div>

      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-semibold text-white">{clip.title}</h1>
            <p className="mt-3 text-sm leading-7 text-muted">Uploaded by {clip.uploader.username}#{clip.uploader.discriminator} · {clip.createdAt.toLocaleDateString()}</p>
            <p className="mt-4 text-sm text-muted">{clip.description}</p>
            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.25em] text-accent">
              <span>{clip.category.name}</span>
              {clip.tags.map((item) => (
                <span key={item.id} className="rounded-full border border-border bg-white/5 px-3 py-1">#{item.tag.name}</span>
              ))}
            </div>
          </div>
          <div className="grid gap-3 text-sm text-muted">
            <div className="rounded-3xl border border-border bg-background/80 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-accent">Likes</p>
              <p className="mt-2 text-2xl font-semibold text-white">{clip.likes.length}</p>
            </div>
            <div className="rounded-3xl border border-border bg-background/80 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-accent">Comments</p>
              <p className="mt-2 text-2xl font-semibold text-white">{clip.comments.length}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
          <h2 className="text-xl font-semibold text-white">Comments</h2>
          {clip.comments.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No comments yet.</p>
          ) : (
            <div className="mt-6 space-y-4">
              {clip.comments.map((comment) => (
                <article key={comment.id} className="rounded-3xl border border-border bg-background/70 p-5">
                  <p className="text-sm font-semibold text-white">{comment.author.username}#{comment.author.discriminator}</p>
                  <p className="mt-2 text-sm leading-7 text-muted">{comment.text}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.2em] text-accent">{comment.createdAt.toLocaleDateString()}</p>
                </article>
              ))}
            </div>
          )}
        </div>
        <aside className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
          <h2 className="text-xl font-semibold text-white">Related clips</h2>
          <p className="mt-4 text-sm text-muted">More clips from this category will appear here soon.</p>
        </aside>
      </section>
    </div>
  );
}
