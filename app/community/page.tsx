import Link from "next/link";

export const dynamic = "force-dynamic";

async function getDiscordSnapshot() {
  try {
    const response = await fetch("https://discord.com/api/v10/invites/Q88NM7XhJ?with_counts=true", { next: { revalidate: 60 } });
    if (!response.ok) return null;
    const data = await response.json() as { guild?: { name?: string; approximate_member_count?: number; approximate_presence_count?: number } };
    return data.guild ?? null;
  } catch {
    return null;
  }
}

export default async function CommunityPage() {
  const guild = await getDiscordSnapshot();
  return <div className="space-y-8"><section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow"><div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]"><div><p className="text-sm uppercase tracking-[0.3em] text-accent">Community</p><h1 className="mt-3 text-3xl font-semibold text-white">{guild?.name ?? "Rhythians Discord"}</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-muted">Stay connected with the Discord community, discover server features, and see a live snapshot of the community alongside the Rhythians website.</p><div className="mt-6 flex flex-wrap gap-3"><Link href="https://discord.gg/Q88NM7XhJ" className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent2">Join Discord</Link></div></div><div className="rounded-3xl border border-border bg-background/80 p-6"><p className="text-sm uppercase tracking-[0.3em] text-accent">Server snapshot</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="rounded-3xl border border-border bg-surface p-5"><p className="text-sm text-muted">Members</p><p className="mt-2 text-3xl font-semibold text-white">{guild?.approximate_member_count?.toLocaleString() ?? "—"}</p><p className="mt-1 text-xs text-muted">Discord members</p></div><div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/5 p-5"><p className="text-sm text-muted">Online</p><p className="mt-2 text-3xl font-semibold text-white">{guild?.approximate_presence_count?.toLocaleString() ?? "—"}</p><p className="mt-1 text-xs text-emerald-300">Current Discord presence</p></div></div>{!guild && <p className="mt-4 text-xs text-muted">Discord snapshot is temporarily unavailable.</p>}</div></div></section><section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow"><h2 className="text-xl font-semibold text-white">Why this website exists</h2><p className="mt-4 text-sm leading-7 text-muted">The website provides organized knowledge, clips, stable resources, and announcements, while Discord remains the place for real-time discussion and events.</p></section></div>;
}
