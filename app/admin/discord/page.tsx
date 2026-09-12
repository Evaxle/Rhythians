import { DiscordIntegration } from "@/components/admin/discord-integration";

export default function AdminDiscordPage() {
  return (
    <div className="ui-page space-y-6">
      <section className="ui-page-header">
        <div>
          <p className="ui-eyebrow">Discord integration</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Sync roles to tags</h1>
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
