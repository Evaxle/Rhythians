import Link from "next/link";
import { Activity, ExternalLink, MessageCircle, Users, Wifi, Server } from "lucide-react";

export const dynamic = "force-dynamic";

const DISCORD_SERVERS = [{ name: "Rhythians Discord", invite: "Q88NM7XhJ" }];

type DiscordMember = { id: string; username?: string; nick?: string | null; avatar_url?: string | null; status?: string };
type DiscordSnapshot = { id?: string; name?: string; approximate_member_count?: number; approximate_presence_count?: number; icon?: string | null; members: DiscordMember[] };

async function getDiscordSnapshot(invite: string): Promise<DiscordSnapshot | null> {
  try {
    const response = await fetch(`https://discord.com/api/v10/invites/${invite}?with_counts=true`, { next: { revalidate: 60 } });
    if (!response.ok) return null;
    const data = await response.json() as { guild?: { id?: string; name?: string; approximate_member_count?: number; approximate_presence_count?: number; icon?: string | null } };
    const guild = data.guild;
    if (!guild) return null;
    let members: DiscordMember[] = [];
    if (guild.id) {
      try {
        const widget = await fetch(`https://discord.com/api/guilds/${guild.id}/widget.json`, { next: { revalidate: 30 } });
        if (widget.ok) members = ((await widget.json()) as { members?: DiscordMember[] }).members ?? [];
      } catch {}
    }
    return { ...guild, members };
  } catch {
    return null;
  }
}

export default async function CommunityPage() {
  const snapshots = await Promise.all(DISCORD_SERVERS.map((server) => getDiscordSnapshot(server.invite)));
  const totalMembers = snapshots.reduce((sum, snapshot) => sum + (snapshot?.approximate_member_count ?? 0), 0);
  const totalOnline = snapshots.reduce((sum, snapshot) => sum + (snapshot?.approximate_presence_count ?? 0), 0);
  return <div className="ui-page space-y-6">
    <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_8%_0%,rgba(124,143,240,0.15),transparent_30%),radial-gradient(circle_at_95%_100%,rgba(85,214,160,0.08),transparent_28%),linear-gradient(145deg,rgba(20,27,45,0.96),rgba(9,13,23,0.98))] p-6 shadow-glow sm:p-8">
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-accent"><MessageCircle size={15} /> Community</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-white">Discord, without the guesswork.</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-muted">See the connected Discord server, current member presence, and live online users before you jump in.</p></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3"><p className="text-[10px] uppercase tracking-[0.18em] text-muted">Servers</p><p className="mt-1 text-xl font-semibold text-white">{DISCORD_SERVERS.length}</p></div><div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3"><p className="text-[10px] uppercase tracking-[0.18em] text-muted">Members</p><p className="mt-1 text-xl font-semibold text-white">{totalMembers.toLocaleString() || "—"}</p></div><div className="hidden rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.04] px-4 py-3 sm:block"><p className="text-[10px] uppercase tracking-[0.18em] text-muted">Online</p><p className="mt-1 text-xl font-semibold text-emerald-300">{totalOnline.toLocaleString() || "—"}</p></div></div></div>
    </section>

    <section className="grid gap-5 lg:grid-cols-2">{DISCORD_SERVERS.map((server, index) => { const snapshot = snapshots[index]; return <article key={server.invite} className="ui-card rounded-[2rem] p-6 shadow-glow"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent"><Server size={22} /></div><div><p className="ui-kicker text-accent">Connected server</p><h2 className="mt-1 text-xl font-semibold text-white">{snapshot?.name ?? server.name}</h2></div></div><span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${snapshot ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-300" : "border-amber-400/20 bg-amber-400/5 text-amber-200"}`}><span className={`h-1.5 w-1.5 rounded-full ${snapshot ? "bg-emerald-400" : "bg-amber-400"}`} />{snapshot ? "Live" : "Unavailable"}</span></div><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-2xl border border-white/10 bg-black/15 p-4"><p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-muted"><Users size={12} /> Members</p><p className="mt-2 text-2xl font-semibold text-white">{snapshot?.approximate_member_count?.toLocaleString() ?? "—"}</p></div><div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.04] p-4"><p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-muted"><Wifi size={12} /> Online</p><p className="mt-2 text-2xl font-semibold text-emerald-300">{snapshot?.approximate_presence_count?.toLocaleString() ?? "—"}</p></div></div><Link href={`https://discord.gg/${server.invite}`} className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent2">Join Discord <ExternalLink size={14} /></Link>{snapshot?.members?.length ? <div className="mt-6 border-t border-white/10 pt-5"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-white">Currently visible online</p><span className="text-xs text-muted">{snapshot.members.length} shown</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{snapshot.members.slice(0, 8).map((member) => <div key={member.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/10 px-3 py-2.5"><div className="h-9 w-9 overflow-hidden rounded-full bg-accent/10">{member.avatar_url ? <img src={member.avatar_url} alt="" className="h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; const fallback = event.currentTarget.parentElement?.querySelector("[data-member-fallback]"); if (fallback) fallback.classList.remove("hidden"); }} /> : null}<span data-member-fallback className={`${member.avatar_url ? "hidden " : ""}flex h-full w-full items-center justify-center text-xs font-bold text-accent`}>{(member.nick ?? member.username ?? "?").charAt(0).toUpperCase()}</span></div><div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{member.nick ?? member.username ?? "Discord member"}</p><p className="flex items-center gap-1 text-[11px] text-emerald-300"><Activity size={10} /> Online</p></div></div>)}</div></div> : <p className="mt-5 border-t border-white/10 pt-5 text-xs leading-5 text-muted">Discord&apos;s public widget is not enabled, so the server&apos;s live online count is shown without the member roster.</p>}</article>; })}</section>

    <section className="rounded-[2rem] border border-white/10 bg-black/10 p-6"><div className="flex items-center gap-3"><Activity className="text-accent" size={19} /><h2 className="text-xl font-semibold text-white">What happens here?</h2></div><p className="mt-3 max-w-4xl text-sm leading-7 text-muted">Discord remains the real-time home for discussions and events, while Rhythians keeps rankings, maps, clips, announcements, and other permanent resources organized in one place.</p></section>
  </div>;
}
