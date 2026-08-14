import Link from "next/link";
import { prisma } from "@/lib/db";

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
    },
  });

  if (!user) {
    return <p className="rounded-3xl border border-border bg-surface/95 p-8 text-muted">Profile not found.</p>;
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-accent">Profile</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">@{user.profileHandle}</h1>
            <p className="mt-3 text-sm leading-7 text-muted">{user.displayName ?? `${user.username}#${user.discriminator}`}</p>
            <p className="mt-4 text-sm text-muted">Discord roles: {user.roles.map((userRole) => userRole.role.name).join(", ") || "Member"}</p>
            {user.playerRank ? (
              <div className="mt-4 inline-flex items-center gap-3 rounded-full border border-border bg-background/80 px-4 py-2 text-sm text-white">
                <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: user.playerRank.color || "#7289da" }} />
                <span>{user.playerRank.name}</span>
              </div>
            ) : null}
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
