import Link from "next/link";
import { Check, Lock, Play, Sparkles } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getSeasonalPath } from "@/lib/seasonal-path";

export const dynamic = "force-dynamic";

export default async function PathPage() {
  const user = await getSessionUser();
  const path = await getSeasonalPath(user?.id);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 text-center shadow-glow">
        <p className="text-sm uppercase tracking-[0.3em] text-accent">Seasonal progression</p>
        <h1 className="mt-3 text-4xl font-semibold text-white">Seasonal Rhythian Path</h1>
        <p className="mt-3 text-sm leading-7 text-muted">Complete one ranked map at a time to progress through this season's path. Each completed rank earns its seasonal rank at the end of the season.</p>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-5 py-2.5 text-sm font-semibold text-accent"><Sparkles size={16} /> Season {path.season.seasonNumber}</div>
        <p className="mt-3 text-xs text-muted">{path.season.startsAt.toLocaleDateString()} – {path.season.endsAt.toLocaleDateString()}</p>
      </section>

      <section className="relative space-y-4">
        {path.ranks.map((rank) => {
          const map = rank.map;
          const targetName = rank.index === path.ranks.length - 1 ? "4.00 rating" : path.ranks[rank.index + 1].name;
          const locked = !map || !map.unlocked;
          return (
            <div key={rank.name} className={`relative rounded-3xl border p-6 transition ${locked ? "border-border bg-background/40 opacity-45 grayscale" : "border-border bg-surface/95 shadow-glow"}`}>
              <div className="flex items-start gap-5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border text-lg font-bold" style={{ borderColor: rank.color, color: rank.color, backgroundColor: `${rank.color}18` }}>
                  {map?.completed ? <Check size={25} /> : locked ? <Lock size={22} /> : rank.index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-semibold" style={{ color: locked ? undefined : rank.color }}>{rank.name}</h2>
                    {map?.completed && <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">Completed</span>}
                    {!map?.completed && !locked && <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">Next path map</span>}
                  </div>
                  <p className="mt-1 text-sm text-muted">Complete a {targetName} map to earn the {rank.name} seasonal rank.</p>
                  {map?.map ? (
                    <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-border bg-background/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-semibold text-white">{map.map.title}</p>
                        {map.map.artist && <p className="mt-1 text-sm text-muted">{map.map.artist}</p>}
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
                          <span>{map.map.rating?.toFixed(2)} rating</span>
                          {map.map.mapperName && <span>Mapped by {map.map.mapperName}</span>}
                        </div>
                      </div>
                      {map.map.mapFileUrl && !locked && !map.completed && <a href={map.map.mapFileUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent2"><Play size={15} /> Play map</a>}
                      {map.completed && <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-300"><Check size={15} /> Passed</span>}
                    </div>
                  ) : (
                    <div className="mt-5 rounded-2xl border border-dashed border-border p-4 text-sm text-muted">No approved map is currently available for this path rank.</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {user && <section className="rounded-3xl border border-border bg-surface/95 p-6 text-sm text-muted shadow-glow"><p className="font-semibold text-white">Your path progress</p><p className="mt-2">{path.completedRank < 0 ? "No path maps completed yet. Start with Copper." : path.completedRank >= path.ranks.length - 1 ? "You have completed the full seasonal path." : `You have completed through ${path.ranks[path.completedRank].name}. Your next map is ${path.ranks[path.completedRank + 1].name}.`}</p><Link href={`/profile/${user.profileHandle}`} className="mt-4 inline-flex rounded-full border border-border bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:border-accent/40">View profile</Link></section>}
    </div>
  );
}
