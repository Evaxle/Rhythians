import Link from "next/link";
import { prisma } from "@/lib/db";
import { RANKS, getRankInfo, rankLabel } from "@/lib/ranks";
import { getSeasonalPath } from "@/lib/seasonal-path";
import { RhythianPathResetButton } from "@/components/admin/rhythian-path-reset-button";

export const dynamic = "force-dynamic";

export default async function AdminRhythianPathPage() {
  const path = await getSeasonalPath();
  const rows = await prisma.$queryRawUnsafe<Array<{ userId: string; username: string; displayName: string | null; profileHandle: string; rhp: number; maxRank: number | null }>>(`SELECT u."id" AS "userId", u."username", u."displayName", u."profileHandle", u."rhp", MAX(c."rankIndex")::int AS "maxRank" FROM "User" u LEFT JOIN "SeasonalPathCompletion" c ON c."userId" = u."id" AND c."seasonId" = $1 GROUP BY u."id" ORDER BY "maxRank" DESC NULLS LAST, u."username" ASC`, path.season.id);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <p className="text-sm uppercase tracking-[0.3em] text-accent">Season {path.season.seasonNumber}</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Rhythian Path</h1>
        <p className="mt-3 text-sm leading-7 text-muted">View the current seasonal path, assigned maps, ratings, completion state, and every user's completed path rank.</p>
        <p className="mt-3 text-xs text-muted">{path.season.startsAt.toLocaleDateString()} – {path.season.endsAt.toLocaleDateString()}</p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {path.ranks.map((rank) => {
          const users = rows.filter((user) => (user.maxRank ?? -1) === rank.index);
          const map = rank.map?.map;
          const target = rank.index === path.ranks.length - 1 ? "4.00+" : path.ranks[rank.index + 1].name;
          return (
            <article key={rank.name} className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
              <div className="flex items-start justify-between gap-4">
                <div><p className="text-xs uppercase tracking-[0.25em] text-muted">Path rank {rank.index + 1}</p><h2 className="mt-2 text-2xl font-semibold" style={{ color: rank.color }}>{rank.name}</h2></div>
                <span className="rounded-full border px-3 py-1 text-xs font-semibold" style={{ borderColor: rank.color, color: rank.color }}>{users.length} users</span>
              </div>
              <div className="mt-5 rounded-2xl border border-border bg-background/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-accent">Required map</p>
                {map ? <><p className="mt-2 text-lg font-semibold text-white">{map.title}</p>{map.artist && <p className="mt-1 text-sm text-muted">{map.artist}</p>}<div className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted sm:grid-cols-4"><div><p>Rating</p><p className="mt-1 font-semibold text-white">{map.rating?.toFixed(2)}</p></div><div><p>Target</p><p className="mt-1 font-semibold text-white">{target}</p></div><div><p>Mapper</p><p className="mt-1 truncate font-semibold text-white">{map.mapperName ?? "Unknown"}</p></div><div><p>Length</p><p className="mt-1 font-semibold text-white">{map.length ? `${Math.round(map.length)}s` : "—"}</p></div></div><div className="mt-4 flex flex-wrap gap-2"><Link href={`/maps/${map.id}`} className="inline-flex rounded-full border border-border bg-white/5 px-4 py-2 text-xs font-semibold text-white hover:border-accent/40">View map</Link><RhythianPathResetButton rankIndex={rank.index} rankName={rank.name} /></div></> : <><p className="mt-2 text-sm text-muted">No map assigned.</p><div className="mt-4"><RhythianPathResetButton rankIndex={rank.index} rankName={rank.name} /></div></>}
              </div>
              <div className="mt-5"><p className="text-xs uppercase tracking-[0.2em] text-accent">Users at this path rank</p>{users.length === 0 ? <p className="mt-3 text-sm text-muted">No users have completed through this rank.</p> : <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">{users.map((user) => <Link key={user.userId} href={`/profile/${user.profileHandle}`} className="flex items-center justify-between rounded-2xl border border-border bg-background/60 px-4 py-3 transition hover:border-accent/40"><span className="min-w-0 truncate font-semibold text-white">{user.displayName ?? user.username}</span><span className="ml-3 shrink-0 text-xs text-muted">@{user.profileHandle}</span></Link>)}</div>}</div>
            </article>
          );
        })}
      </section>

      <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
        <p className="text-xs uppercase tracking-[0.25em] text-accent">All users</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Current path progress</h2>
        <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-border text-xs uppercase tracking-[0.18em] text-muted"><th className="px-3 py-3">User</th><th className="px-3 py-3">Path rank</th><th className="px-3 py-3">Next map</th><th className="px-3 py-3">Regular rank</th><th className="px-3 py-3">RHP</th></tr></thead><tbody>{rows.map((user) => { const index = user.maxRank ?? -1; const next = path.ranks[index + 1]; const regular = getRankInfo(user.rhp); return <tr key={user.userId} className="border-b border-border/60"><td className="px-3 py-3"><Link href={`/profile/${user.profileHandle}`} className="font-semibold text-white hover:text-accent">{user.displayName ?? user.username}</Link></td><td className="px-3 py-3 text-muted">{index < 0 ? "Not started" : RANKS[index]?.name ?? "Expert"}</td><td className="px-3 py-3 text-muted">{next?.map?.map?.title ?? "Complete"}</td><td className="px-3 py-3 text-muted">{rankLabel(regular)}</td><td className="px-3 py-3 text-muted">{user.rhp}</td></tr>; })}</tbody></table></div>
      </section>
    </div>
  );
}
