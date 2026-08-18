import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getGuildInfo, getGuildRoles } from "@/lib/discord";
import { getOnboardingData, getSelectedOptionIds } from "@/lib/onboarding";
import { getAvatarUrl } from "@/lib/avatar";
import { UserTags } from "@/components/user-tags";
import { DiscordSyncButton } from "@/components/discord-sync-button";
import { AvatarUploader } from "@/components/avatar-uploader";
import { OnboardingForm } from "@/components/onboarding-form";
import { CursorSettings } from "@/components/cursor-settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: { userTags: { include: { tag: true } } },
  });

  if (!fullUser) redirect("/login");

  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  const guild = token && guildId ? await getGuildInfo(token, guildId) : null;
  const roles = token && guildId ? await getGuildRoles(token, guildId) : [];

  const roleNameById = new Map(roles.map((role) => [role.id, role.name]));
  const roleNames = fullUser.discordRoles
    .map((roleId) => roleNameById.get(roleId) ?? roleId)
    .filter((name, index, array) => array.indexOf(name) === index);

  const avatarUrl = getAvatarUrl(fullUser, 128);

  const onboardingData = await getOnboardingData(prisma);
  const userTagSlugs = new Set(fullUser.userTags.map((ut) => ut.tag.slug));
  const selectedOptionIds = await getSelectedOptionIds(prisma, onboardingData, userTagSlugs);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <p className="text-sm uppercase tracking-[0.3em] text-accent">Settings</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Account</h1>
        <p className="mt-3 text-sm leading-7 text-muted">
          Manage your profile picture, roles, and Discord connection.
        </p>
      </section>

      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <p className="text-sm uppercase tracking-[0.3em] text-accent">Profile</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Profile picture</h2>
        <div className="mt-6">
          <AvatarUploader avatarUrl={avatarUrl} username={fullUser.username} />
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <p className="text-sm uppercase tracking-[0.3em] text-accent">Roles &amp; tags</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Your answers and tags</h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          {fullUser.discordId
            ? "Your tags are synced from your Discord roles. You can also adjust your onboarding answers below."
            : "Change what you answered during onboarding — your tags update automatically."}
        </p>

        {fullUser.userTags.length > 0 && (
          <div className="mt-6">
            <p className="mb-3 text-sm uppercase tracking-[0.24em] text-accent">Your tags</p>
            <UserTags tags={fullUser.userTags} size="md" />
          </div>
        )}

        {onboardingData.prompts.length > 0 ? (
          <div className="mt-8 border-t border-border pt-8">
            <OnboardingForm prompts={onboardingData.prompts} initialSelected={selectedOptionIds} submitLabel="Save changes" />
          </div>
        ) : (
          <p className="mt-6 rounded-2xl border border-dashed border-border bg-background/70 p-6 text-sm text-muted">
            Onboarding questions are configured in Discord. Once added, they&apos;ll appear here.
          </p>
        )}
      </section>

      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <p className="text-sm uppercase tracking-[0.3em] text-accent">Customization</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Cursor</h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          Toggle the Rhythia-style custom cursor and its trail.
        </p>
        <div className="mt-6 border-t border-border pt-6">
          <CursorSettings />
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-accent">Discord connection</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              {fullUser.username}#{fullUser.discriminator}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {fullUser.inGuild ? (
                <span className="text-green-300">Connected to {guild?.name ?? "the server"}</span>
              ) : (
                "Not in the Discord server"
              )}
            </p>
          </div>
          <DiscordSyncButton />
        </div>

        {roleNames.length > 0 && (
          <div className="mt-8">
            <p className="mb-3 text-sm uppercase tracking-[0.24em] text-accent">Discord roles</p>
            <div className="flex flex-wrap gap-1.5">
              {roleNames.map((roleName) => (
                <span
                  key={roleName}
                  className="inline-flex items-center rounded-full border border-border bg-white/5 px-2.5 py-1 text-xs text-white"
                >
                  {roleName}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 border-t border-border pt-6">
          <Link
            href={`https://discord.com/channels/${guildId ?? ""}`}
            className="text-sm font-semibold text-accent transition hover:text-accent/80"
          >
            Open the Discord server →
          </Link>
        </div>
      </section>
    </div>
  );
}
