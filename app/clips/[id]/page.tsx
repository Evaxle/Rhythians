import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";
import { getSessionUser, isOwner } from "@/lib/auth";
import { getAvatarUrl } from "@/lib/avatar";
import { cameraModeLabel, cameraModeEmoji } from "@/lib/camera-mode";
import { ClipComments } from "@/components/clip-comments";
import { CoachComments } from "@/components/coach-comments";
import { LikeButton } from "@/components/like-button";
import { UserTags } from "@/components/user-tags";
import { ReportButton } from "@/components/report-button";
import { CopyClipId } from "@/components/copy-clip-id";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

async function getPublicUrl(path: string) {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.storage
    .from(process.env.STORAGE_BUCKET ?? "media")
    .createSignedUrl(path, 60);
  if (error || !data) return null;
  return data.signedUrl;
}

export default async function ClipPage({ params }: Props) {
  const { id } = await params;
  const sessionUser = await getSessionUser();

  const clip = await prisma.clip.findUnique({
    where: { id },
    include: {
      uploader: {
        include: {
          userTags: {
            include: { tag: true },
          },
        },
      },
      reviewedBy: { select: { username: true, discriminator: true, displayName: true } },
      category: true,
      comments: {
        orderBy: { createdAt: "desc" },
        include: {
          author: {
            include: {
              userTags: {
                include: { tag: true },
              },
            },
          },
        },
      },
      coachComments: {
        orderBy: { createdAt: "desc" },
        include: {
          author: {
            include: {
              userTags: {
                include: { tag: true },
              },
            },
          },
        },
      },
      likes: true,
    },
  });

  if (!clip) {
    return notFound();
  }

  const canViewClip =
    clip.status === "approved" ||
    (Boolean(sessionUser) &&
      (sessionUser!.id === clip.uploaderId ||
        clip.reviewedById === sessionUser!.id ||
        isOwner(sessionUser)));

  if (!canViewClip) {
    return notFound();
  }

  const videoUrl = await getPublicUrl(clip.storagePath);

  let isLiked = false;
  let isCoach = false;

  if (sessionUser) {
    isLiked = clip.likes.some((like) => like.userId === sessionUser.id);

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      include: {
        userTags: {
          include: { tag: true },
        },
      },
    });

    isCoach = user?.userTags.some((ut) => ut.tag.slug === "rhythian-coach") ?? false;
  }

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-border bg-surface/95 shadow-glow">
        <div className="aspect-video bg-black">
          {videoUrl ? (
            <video
              controls
              className="h-full w-full object-cover"
              src={videoUrl}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted">
              Video preview is unavailable.
            </div>
          )}
        </div>
      </div>

      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-semibold text-white">{clip.title}</h1>
            <div className="mt-2 flex items-center gap-3">
              <CopyClipId clipId={clip.id} />
              <p className="text-xs text-muted">Tag it with <span className="font-semibold text-white">/clip {clip.id.slice(0, 8)}…</span></p>
            </div>
            <div className="mt-3 flex items-center gap-3">
              {getAvatarUrl(clip.uploader, 64) ? (
                <img
                  src={getAvatarUrl(clip.uploader, 64)!}
                  alt=""
                  className="h-8 w-8 rounded-full"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold text-accent">
                  {clip.uploader.username.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-white">
                  {clip.uploader.username}#{clip.uploader.discriminator}
                </p>
                <p className="text-xs text-muted">
                  {clip.createdAt.toLocaleDateString()}
                </p>
              </div>
              {clip.uploader.userTags.length > 0 && (
                <UserTags tags={clip.uploader.userTags} size="sm" />
              )}
            </div>
            {clip.status === "approved" && clip.reviewedBy && (
              <p className="mt-3 inline-flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                  Approved
                </span>
                Approved by <span className="font-semibold text-white">{clip.reviewedBy.displayName ?? clip.reviewedBy.username}</span>
              </p>
            )}
            {clip.status === "rejected" && (
              <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-400/10 p-4">
                <p className="text-sm font-semibold text-red-200">
                  Denied by {clip.reviewedBy ? (clip.reviewedBy.displayName ?? clip.reviewedBy.username) : "a reviewer"}
                </p>
                {clip.rejectionReason && <p className="mt-1 text-sm leading-6 text-red-100/80">{clip.rejectionReason}</p>}
              </div>
            )}
            <p className="mt-4 text-sm text-muted">{clip.description}</p>
            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.25em] text-accent">
              <span>{clip.category?.name ?? "Uncategorized"}</span>
              {cameraModeLabel(clip.cameraMode) && (
                <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-accent">
                  {cameraModeEmoji(clip.cameraMode)} {cameraModeLabel(clip.cameraMode)}
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-3 text-sm text-muted">
            <LikeButton
              clipId={clip.id}
              initialLikes={clip.likes.length}
              isLiked={isLiked}
              isAuthenticated={Boolean(sessionUser)}
            />
            <div className="rounded-3xl border border-border bg-background/80 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-accent">
                Comments
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {clip.comments.length}
              </p>
            </div>
            {sessionUser && <ReportButton targetType="clip" targetId={clip.id} targetLabel={clip.title} />}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
            <h2 className="text-xl font-semibold text-white">Comments</h2>

            <ClipComments
              clipId={clip.id}
              isAuthenticated={Boolean(sessionUser)}
              comments={clip.comments.map((comment) => ({
                id: comment.id,
                text: comment.text,
                createdAt: comment.createdAt.toISOString(),
                author: {
                  username: comment.author.username,
                  discriminator: comment.author.discriminator,
                  userTags: comment.author.userTags.map((ut) => ({
                    tag: { name: ut.tag.name, slug: ut.tag.slug },
                  })),
                },
              }))}
            />
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-accent/30 bg-accent/5 p-6 shadow-glow">
            <CoachComments
              clipId={clip.id}
              comments={clip.coachComments.map((comment) => ({
                id: comment.id,
                text: comment.text,
                createdAt: comment.createdAt.toISOString(),
                author: {
                  id: comment.author.id,
                  username: comment.author.username,
                  discriminator: comment.author.discriminator,
                  avatar: comment.author.avatar,
                  userTags: comment.author.userTags.map((ut) => ({
                    tag: { name: ut.tag.name, slug: ut.tag.slug },
                  })),
                },
              }))}
              isCoach={isCoach}
              isAuthenticated={Boolean(sessionUser)}
            />
          </div>
        </aside>
      </section>
    </div>
  );
}
