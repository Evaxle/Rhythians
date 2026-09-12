import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getGuildInfo, getGuildRoles } from "@/lib/discord";
import { getAvatarUrl } from "@/lib/avatar";
import { UserTags } from "@/components/user-tags";
import { DiscordSyncButton } from "@/components/discord-sync-button";
import { AvatarUploader } from "@/components/avatar-uploader";
import { CursorSettings } from "@/components/cursor-settings";
import { CheckAllScoresButton } from "@/components/check-all-scores-button";
import { AccountSecurity } from "@/components/account-security";
import { RhythianClientSettings } from "@/components/client/rhythian-client-settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const fullUser = await prisma.user.findUnique({ where: { id: user.id }, include: { userTags: { include: { tag: true } }, rhythiaProfile: true, playerRank: true } });
  if (!fullUser) redirect("/login");
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  const guild = token && guildId ? await getGuildInfo(token, guildId) : null;
  const roles = token && guildId ? await getGuildRoles(token, guildId) : [];
  const roleNameById = new Map(roles.map((role) => [role.id, role.name]));
  const roleNames = fullUser.discordRoles.map((roleId) => roleNameById.get(roleId) ?? roleId).filter((name, index, array) => array.indexOf(name) === index);
  const avatarUrl = getAvatarUrl(fullUser, 128);

  return <div className="ui-page settings-grid">
    <section className="ui-page-header"><p className="ui-eyebrow">Rhythian Client settings</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Settings</h1><p className="mt-3 text-sm leading-7 text-muted">The web client uses the same gameplay modifier categories as Rhythian Client while keeping your Rhythians account, profile, ranks, maps, and Discord connection in one place.</p><div className="mt-6 flex flex-wrap gap-2"><a href="#client-gameplay" className="inline-flex rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white">Gameplay</a><a href="#account" className="inline-flex rounded-full border border-border bg-white/5 px-4 py-2.5 text-sm font-semibold text-white">Account</a><Link href="/maps" className="inline-flex rounded-full border border-border bg-white/5 px-4 py-2.5 text-sm font-semibold text-white">Map selection</Link><Link href="/community-settings" className="inline-flex rounded-full border border-border bg-white/5 px-4 py-2.5 text-sm font-semibold text-white">Community settings</Link></div></section>
    <section id="client-gameplay" className="ui-panel scroll-mt-24"><RhythianClientSettings /></section>
    <div id="account" className="scroll-mt-24" />
    {!fullUser.discordId && <section className="ui-panel"><p className="ui-eyebrow">Security</p><h2 className="mt-2 text-2xl font-semibold text-white">Email two-factor authentication</h2><p className="mt-2 text-sm leading-7 text-muted">Email 2FA adds a second verification step after your password. Your email address must be verified before it can be used for sign-in protection.</p><div className="mt-6 border-t border-border pt-6"><AccountSecurity email={fullUser.email} emailVerifiedAt={fullUser.emailVerifiedAt} emailTwoFactorEnabled={fullUser.emailTwoFactorEnabled} /></div></section>}
    <section className="ui-panel"><p className="ui-eyebrow">Profile</p><h2 className="mt-2 text-2xl font-semibold text-white">Profile picture</h2><div className="mt-6"><AvatarUploader avatarUrl={avatarUrl} username={fullUser.username} /></div></section>
    {fullUser.rhythiaProfile && <section className="ui-panel"><p className="ui-eyebrow">Rhythia scores</p><h2 className="mt-2 text-2xl font-semibold text-white">Import your old scores</h2><p className="mt-2 text-sm leading-7 text-muted">Your past Rhythia scores are imported automatically when you link your account. Only maps inside your current rank&apos;s rating range award RHP. If you&apos;ve played more ranked maps since then, run the scan again to claim the RHP for any new completions.</p><div className="mt-6 border-t border-border pt-6"><CheckAllScoresButton /></div></section>}
    <section className="ui-panel"><p className="ui-eyebrow">Automatic classification</p><h2 className="mt-2 text-2xl font-semibold text-white">Rhythia rank and account tags</h2><p className="mt-2 text-sm leading-7 text-muted">Your player classification updates automatically from your linked Rhythia global rank. Veteran and Mentor are assigned from the creation year of your Rhythia account.</p><div className="mt-6 flex flex-wrap items-center gap-3">{fullUser.playerRank ? <span className="inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-semibold" style={{ borderColor: `${fullUser.playerRank.color ?? "#7289da"}66`, color: fullUser.playerRank.color ?? "#7289da" }}>{fullUser.playerRank.name}</span> : <span className="text-sm text-muted">Link or refresh your Rhythia account to receive a classification.</span>}{fullUser.userTags.length > 0 && <UserTags tags={fullUser.userTags} size="md" />}</div></section>
    <section className="ui-panel"><p className="ui-eyebrow">Customization</p><h2 className="mt-2 text-2xl font-semibold text-white">Website cursor</h2><p className="mt-2 text-sm leading-7 text-muted">Toggle the Rhythia-style custom cursor and its trail across the website. Gameplay has its own client-compatible cursor settings above.</p><div className="mt-6 border-t border-border pt-6"><CursorSettings /></div></section>
    <section className="ui-panel"><div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between"><div><p className="ui-eyebrow">Discord connection</p><h2 className="mt-2 text-2xl font-semibold text-white">{fullUser.username}#{fullUser.discriminator}</h2><p className="mt-1 text-sm text-muted">{fullUser.inGuild ? <span className="text-green-300">Connected to {guild?.name ?? "the server"}</span> : "Not in the Discord server"}</p></div><DiscordSyncButton /></div>{roleNames.length > 0 && <div className="mt-8"><p className="mb-3 text-sm uppercase tracking-[0.24em] text-accent">Discord roles</p><div className="flex flex-wrap gap-1.5">{roleNames.map((roleName) => <span key={roleName} className="inline-flex items-center rounded-full border border-border bg-white/5 px-2.5 py-1 text-xs text-white">{roleName}</span>)}</div></div>}<div className="mt-8 border-t border-border pt-6"><Link href={`https://discord.com/channels/${guildId ?? ""}`} className="text-sm font-semibold text-accent transition hover:text-accent/80">Open the Discord server →</Link></div></section>
  </div>;
}
