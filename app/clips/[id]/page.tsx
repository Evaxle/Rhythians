import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { getAvatarUrl } from "@/lib/avatar";
import { cameraModeLabel, cameraModeEmoji } from "@/lib/camera-mode";
import { Music, Tag as TagIcon } from "lucide-react";
import { ClipComments } from "@/components/clip-comments";
import { CoachComments } from "@/components/coach-comments";
import { ClipPlayer } from "@/components/clip-player";
import { getRhythiaStatus } from "@/lib/rhythia-status";
import { LikeButton } from "@/components/like-button";
import { UserTags } from "@/components/user-tags";
import { FlagIcon } from "@/components/flag-icon";
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
          rhythiaProfile: { select: { id: true, profileId: true, country: true, flag: true, isOnline: true, lastActiveAt: true, statusCheckedAt: true } },
        },
      },
      reviewedBy: { select: { username: true, discriminator: true, displayName: true } },
      category: true,
      tags: { include: { tag: true } },
      comments: {
        orderBy: { createdAt: "desc" },
        include: {
          author: {
            include: {
              userTags: {
                include: { tag: true },
              },
              rhythiaProfile: { select: { country: true, flag: true } },
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
              rhythiaProfile: { select: { country: true, flag: true } },
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
        (await canAccessAdmin(sessionUser))));

  if (!canViewClip) {
    return notFound();
  }

  const videoUrl = await getPublicUrl(clip.storagePath);

  let uploaderPresence: { isOnline: boolean; lastActiveAt: Date | null } | null = null;
  if (clip.uploader.rhythiaProfile) {
    uploaderPresence = await getRhythiaStatus(clip.uploader.rhythiaProfile);
  }

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
            <ClipPlayer src={videoUrl} />
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
              <a href={`/users/${clip.uploader.profileHandle}`} className="text-sm font-semibold text-accent transition hover:text-accent/80">
                {clip.uploader.displayName ?? clip.uploader.username}
              </a>
              {uploaderPresence && (
                <span className={`text-xs ${uploaderPresence.isOnline ? "text-green-300" : "text-muted"}`}>
                  {uploaderPresence.isOnline ? "Online" : "Offline"}
                </span>
              )}
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-muted">{clip.description}</p>
            {clip.songName && (
              <div className="mt-5 flex items-center gap-2 text-sm text-muted">
                <Music className="h-4 w-4 text-accent" />
                <span>{clip.songName}</span>
              </div>
            )}
            {clip.tags.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {clip.tags.map(({ tag }) => (
                  <a key={tag.id} href={`/clips?tag=${encodeURIComponent(tag.slug)}`} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs text-muted transition hover:border-accent/50 hover:text-white">
                    <TagIcon className="h-3.5 w-3.5" />
                    {tag.name}
                  </a>
                ))}
              </div>
            )}

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
                  id: comment.author.id,
                  username: comment.author.username,
                  discriminator: comment.author.discriminator,
                  profileHandle: comment.author.profileHandle,
                  country: comment.author.rhythiaProfile?.country ?? null,
                  flag: comment.author.rhythiaProfile?.flag ?? null,
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
                  profileHandle: comment.author.profileHandle,
                  country: comment.author.rhythiaProfile?.country ?? null,
                  flag: comment.author.rhythiaProfile?.flag ?? null,
                  userTags: comment.author.userTags.map((ut) => ({
                    tag: { name: ut.tag.name, slug: ut.tag.slug },
                  })),
                },
              }))}
            />
          </div>
        </aside>
      </section>
    </div>
  );
}