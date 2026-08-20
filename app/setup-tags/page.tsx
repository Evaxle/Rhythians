import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { DiscordApiError, getGuildMemberById } from "@/lib/discord";
import { syncUserTagsFromDiscord } from "@/lib/discord-sync";
import { getOnboardingData, getSelectedOptionIds } from "@/lib/onboarding";
import { OnboardingForm } from "@/components/onboarding-form";

export const dynamic = "force-dynamic";

export default async function SetupTagsPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login");

  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  const inviteUrl = process.env.DISCORD_INVITE_URL;
  let inGuild = false;
  let discordError = "";

  if (token && guildId && sessionUser.discordId) {
    try {
      const member = await getGuildMemberById(token, guildId, sessionUser.discordId);
      inGuild = member !== null;
      await prisma.user.update({
        where: { id: sessionUser.id },
        data: { inGuild, discordRoles: member?.roles ?? [] },
      });
      if (member) await syncUserTagsFromDiscord(prisma, sessionUser.id, member.roles ?? []);
      else await prisma.userTag.deleteMany({ where: { userId: sessionUser.id, source: "discord" } });
    } catch (error) {
      discordError = error instanceof DiscordApiError && error.status === 429
        ? "Discord is temporarily rate limiting the server check. Try refreshing this page in a moment."
        : "We could not verify your Discord membership right now. Try refreshing this page.";
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    include: { userTags: { include: { tag: true } } },
  });
  if (!user) redirect("/login");

  const onboardingData = await getOnboardingData(prisma);
  const selectedOptionIds = await getSelectedOptionIds(
    prisma,
    onboardingData,
    new Set(user.userTags.map((userTag) => userTag.tag.slug))
  );

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <p className="text-sm uppercase tracking-[0.3em] text-accent">Profile setup</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Set up your Rhythians tags</h1>
        <p className="mt-3 text-sm leading-7 text-muted">We check your Discord membership first, then use the questions below to set up your profile tags.</p>
      </section>

      {!inGuild ? (
        <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
          <p className="text-sm uppercase tracking-[0.3em] text-accent">Discord required</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Join the Rhythians Discord</h2>
          <p className="mt-3 text-sm leading-7 text-muted">You are not currently verified as a member of the Rhythians Discord server. Join it, then return to this page and it will check your membership again automatically.</p>
          {discordError && <p className="mt-4 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-4 text-sm text-yellow-200">{discordError}</p>}
          {inviteUrl ? (
            <Link href={inviteUrl} target="_blank" rel="noreferrer" className="mt-6 inline-flex rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent2">Join Discord</Link>
          ) : (
            <p className="mt-6 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">The Discord invite is not configured. Set DISCORD_INVITE_URL in the production environment.</p>
          )}
        </section>
      ) : (
        <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
          <p className="text-sm uppercase tracking-[0.3em] text-accent">Discord verified</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Choose your tags</h2>
          <p className="mt-3 text-sm leading-7 text-muted">Your Discord membership is confirmed. Answer the questions to finish your profile setup.</p>
          {onboardingData.prompts.length > 0 ? (
            <div className="mt-8 border-t border-border pt-8">
              <OnboardingForm prompts={onboardingData.prompts} initialSelected={selectedOptionIds} submitLabel="Save my tags" />
            </div>
          ) : (
            <p className="mt-6 rounded-2xl border border-dashed border-border bg-background/70 p-6 text-sm text-muted">No tag questions are currently configured.</p>
          )}
        </section>
      )}
    </div>
  );
}
