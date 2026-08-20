import { prisma } from "@/lib/db";
import { getAvatarUrl } from "@/lib/avatar";
import { UserTagsManager } from "@/components/user-tags-manager";
import { AdminUserSearch } from "@/components/admin-user-search";
import { AdminUserProfileControls } from "@/components/admin-user-profile-controls";
import { ResetRatingSystem } from "@/components/admin/reset-rating-system";
import { AdminCheckUserScores } from "@/components/admin/check-user-scores";
import { AdminDiscordStatusCheck } from "@/components/admin/discord-status-check";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" }, include: { userTags: { include: { tag: true } } } });
  const allTags = await prisma.tag.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <p className="text-sm uppercase tracking-[0.3em] text-accent">User management</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Manage users and their profiles</h1>
        <p className="mt-3 text-sm leading-7 text-muted">Search for a user to view full details, punish accounts, or assign tags. Use the profile editor on any user to change their challenge levels and, for the site owner, their profile title.</p>
      </section>

      <AdminDiscordStatusCheck />
      <AdminCheckUserScores />
      <AdminUserSearch />
      <ResetRatingSystem />

      <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
        <p className="text-sm uppercase tracking-[0.3em] text-accent">All users</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">User profiles</h2>
        <p className="mt-2 text-sm leading-7 text-muted">Edit tags, challenge progression, and owner-only profile titles directly from each user.</p>
      </section>

      <div className="space-y-4">
        {users.length === 0 ? <div className="rounded-3xl border border-border bg-surface/95 p-8 text-center text-sm text-muted">No users have signed in yet.</div> : users.map((user) => (
          <div key={user.id} className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                {getAvatarUrl(user, 64) ? <img src={getAvatarUrl(user, 64)!} alt="" className="h-12 w-12 rounded-full" /> : <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/20 text-lg font-semibold text-accent">{user.username.charAt(0).toUpperCase()}</div>}
                <div>
                  <p className="font-semibold text-white">{user.displayName ?? user.username}</p>
                  <p className="text-sm text-muted">@{user.profileHandle} · {user.username}#{user.discriminator}</p>
                  <p className="mt-1 text-xs text-muted">{user.inGuild ? "In server" : "Not in server"} · Joined {user.joinedAt.toLocaleDateString()}</p>
                </div>
              </div>
              <div className="w-full lg:max-w-md">
                <UserTagsManager userId={user.id} currentTags={user.userTags.map((ut) => ({ id: ut.tag.id, name: ut.tag.name, slug: ut.tag.slug }))} allTags={allTags.map((tag) => ({ id: tag.id, name: tag.name, slug: tag.slug }))} />
              </div>
            </div>
            <AdminUserProfileControls userId={user.id} />
          </div>
        ))}
      </div>
    </div>
  );
}
