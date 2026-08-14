import Link from "next/link";
import { prisma } from "@/lib/db";
import { UserTags } from "@/components/user-tags";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ username: string }>;
};

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const user = await prisma.user.findFirst({
    where: { profileHandle: username },
    include: {
      clips: { where: { status: "approved" }, orderBy: { createdAt: "desc" }, include: { category: true } },
      articleRevisions: true,
      roles: { include: { role: true } },
      playerRank: true,
      userTags: { include: { tag: true } },
    },
  });

  if (!user) {
    return <p className="rounded-3xl border border-border bg-surface/95 p-8 text-muted">Profile not found.</p>;
  }

  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=256`
    : null;

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-6">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={`${user.username}'s avatar`}
                className="h-24 w-24 rounded-full border-2 border-accent/30"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-accent/30 bg-accent/10 text-3xl font-bold text-accent">
                {user.username.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-accent">Profile</p>
              <h1 className="mt-2 text-3xl font-semibold text-white">{user.displayName ?? user.username}</h1>
              <p className="mt-1 text-sm text-muted">@{user.profileHandle}</p>
              {user.userTags.length > 0 && (
                <div className="mt-4">
                  <UserTags tags={user.userTags} size="md" />
                </div>
              )}
              {user.bio && (
                <p className="mt-4 text-sm leading-7 text-muted">{user.bio}</p>
              )}
            </div>
          </div>
          <div className="rounded-3xl border border-border bg-background/80 px-5 py-4 text-sm text-muted">
            <p>Member since</p>
            <p className="mt-2 text-lg font-semibold text-white">{user.joinedAt.toLocaleDateString()}</p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-accent">Clips</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Approved clips from this creator</h2>
          </div>
          <p className="text-sm text-muted">{user.clips.length} approved clip{user.clips.length === 1 ? "" : "s"}</p>
        </div>

        {user.clips.length === 0 ? (
          <div className="rounded-3xl border border-border bg-background/80 p-8 text-sm text-muted">No approved clips are visible yet.</div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {user.clips.map((clip) => (
              <Link key={clip.id} href={`/clips/${clip.id}`} className="overflow-hidden rounded-3xl border border-border bg-surface/95 p-5 transition hover:-translate-y-0.5 hover:border-accent/40">
                <div className="h-40 rounded-3xl bg-white/5" />
                <div className="mt-4">
                  <p className="text-sm uppercase tracking-[0.24em] text-accent">{clip.category.name}</p>
                  <h3 className="mt-3 text-lg font-semibold text-white">{clip.title}</h3>
                  <p className="mt-2 text-sm text-muted">{clip.createdAt.toLocaleDateString()}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
