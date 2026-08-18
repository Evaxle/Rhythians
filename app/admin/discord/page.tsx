import { DiscordIntegration } from "@/components/admin/discord-integration";

export default function AdminDiscordPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-accent">Discord integration</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Sync roles to tags</h1>
          <p className="mt-3 text-sm leading-7 text-muted">
            Connect Discord roles to website tags. Members who join the server and pick their roles get
            matching tags on their website profile automatically, updated in real time by the bot.
          </p>
        </div>
      </section>
      <DiscordIntegration />
    </div>
  );
}
