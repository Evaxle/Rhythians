import Link from "next/link";
import { Link2, LogIn, Map as MapIcon } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getApprovedMaps } from "@/lib/maps-legacy";
import { RANKS, RANK_TIERS, TIER_SPAN, getRankInfo } from "@/lib/ranks";
import { MapsBrowser } from "@/components/maps/maps-browser";
import { CheckAllRankedMapsButton } from "@/components/maps/check-all-ranked-maps-button";

export const dynamic = "force-dynamic";

function rankLabel(rankName: string, tier: number) {
  return `${rankName} ${tier}`;
}

export default async function MapsPage() {
  const user = await getSessionUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <section className="rounded-3xl border border-border bg-surface/95 p-10 text-center shadow-glow">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <LogIn size={26} />
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-white">Sign in to browse ranked maps</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">Ranked challenge maps, the ranked ladder, and Rhythian Points are reserved for members with a linked Rhythia account. Sign in to get started.</p>
          <Link href="/login" className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent2"><LogIn size={16} /> Sign in</Link>
        </section>
      </div>
    );
  }

  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId: user.id }, select: { id: true } });

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <section className="rounded-3xl border border-border bg-surface/95 p-10 text-center shadow-glow">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent"><Link2 size={26} /></div>
          <h1 className="mt-5 text-2xl font-semibold text-white">Link your Rhythia account</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">To play ranked maps and earn Rhythian Points you first need to link your Rhythia profile. Visit your profile page and connect your account.</p>
          <Link href={`/profile/${user.profileHandle}`} className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent2"><Link2 size={16} /> Go to my profile</Link>
        </section>
      </div>
    );
  }

  const [data, userRow] = await Promise.all([
    getApprovedMaps(true, user.id),
    prisma.user.findUnique({ where: { id: user.id }, select: { rhp: true } }),
  ]);

  const userRhp = userRow?.rhp ?? 0;
  const rankInfo = data.rankInfo ?? getRankInfo(userRhp);
  const nextLabel = rankInfo.isExpert && rankInfo.tier === RANK_TIERS ? "Max rank" : rankInfo.tier < RANK_TIERS ? rankLabel(rankInfo.name, rankInfo.tier + 1) : rankLabel(RANKS[Math.min(rankInfo.index + 1, RANKS.length - 1)].name, 1);
  const progressValue = rankInfo.isExpert && rankInfo.tier === RANK_TIERS ? 1 : rankInfo.progressToNextTier;
  const progressPercent = Math.round(progressValue * 100);
  const remainingRhp = rankInfo.isExpert && rankInfo.tier === RANK_TIERS ? 0 : Math.max(0, rankInfo.nextTierStart - Math.max(0, Math.floor(userRhp)));
  const ladder = RANKS.flatMap((rank) => Array.from({ length: rankInfo.isExpert && rank.name === "Expert" ? RANK_TIERS : RANK_TIERS }, (_, tierIndex) => ({ rank, tier: tierIndex + 1, minRhp: rank.minRhp + tierIndex * TIER_SPAN }))).reverse();

  return (
    <div className="mx-auto max-w-[1400px] space-y-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-8">
          <section className="space-y-3">
            <p className="flex items-center gap-2 text-sm uppercase tracking-[0.24em] text-accent"><MapIcon size={16} /> Ranked maps</p>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-3xl font-semibold text-white">Ranked maps</h1>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">Beat ranked maps within your rank&apos;s rating range to earn Rhythian Points (RHP) and climb the ladder. Maps outside your range won&apos;t earn points.</p>
              </div>
              <CheckAllRankedMapsButton />
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-surface/95 p-5 shadow-glow">
            <div className="flex items-end justify-between gap-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted">Current</p>
                <p className="mt-1 text-lg font-semibold" style={{ color: rankInfo.color }}>{rankInfo.isExpert && rankInfo.tier === RANK_TIERS ? "Expert 5" : rankLabel(rankInfo.name, rankInfo.tier)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.2em] text-muted">Next</p>
                <p className="mt-1 text-lg font-semibold" style={{ color: rankInfo.color }}>{nextLabel}</p>
              </div>
            </div>
            <div className="mt-4 h-4 overflow-hidden rounded-full border border-border bg-background/70">
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(3, progressPercent)}%`, background: `linear-gradient(90deg, ${rankInfo.color}66, ${rankInfo.color})` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted">
              <span>{userRhp.toLocaleString()} RHP</span>
              <span>{rankInfo.isExpert && rankInfo.tier === RANK_TIERS ? "Maximum rank" : `${remainingRhp.toLocaleString()} RHP to next tier`}</span>
              <span>{rankInfo.isExpert && rankInfo.tier === RANK_TIERS ? "MAX" : `${progressPercent}%`}</span>
            </div>
          </section>

          {data.rankInfo ? (
            <MapsBrowser
              maps={data.maps.map((map) => ({
                id: map.id,
                title: map.title,
                artist: map.artist,
                description: map.description,
                mapFileUrl: map.mapFileUrl,
                imageUrl: map.imageUrl,
                rating: map.rating,
                rankIndex: map.rankIndex,
                rankName: map.rankName,
                rankColor: map.rankColor,
                mapperName: map.mapperName,
                noteCount: map.noteCount,
                length: map.length,
                completion: map.completion,
                hasScore: map.hasScore,
                submittedBy: map.submittedBy,
                reviewedBy: map.reviewedBy,
              }))}
              rankInfo={data.rankInfo}
              userRhp={userRhp}
              currentUserId={user.id}
            />
          ) : (
            <p className="rounded-3xl border border-border bg-surface/95 p-8 text-sm text-muted">Unable to load your rank.</p>
          )}
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <section className="rounded-3xl border border-border bg-surface/95 p-5 shadow-glow">
            <div className="mb-4">
              <p className="text-xs uppercase tracking-[0.2em] text-accent">Rank ladder</p>
              <h2 className="mt-1 text-lg font-semibold text-white">All ranks and tiers</h2>
            </div>
            <div className="max-h-[calc(100vh-120px)] space-y-2 overflow-y-auto pr-1">
              {ladder.map(({ rank, tier, minRhp }) => {
                const active = rank.index === rankInfo.index && tier === rankInfo.tier;
                return (
                  <div key={`${rank.name}-${tier}`} className="flex items-center justify-between rounded-2xl border px-3 py-2.5 transition" style={{ borderColor: active ? `${rank.color}99` : "rgba(255,255,255,0.08)", background: active ? `${rank.color}18` : "rgba(0,0,0,0.12)", boxShadow: active ? `0 0 18px ${rank.color}18` : "none" }}>
                    <div className="flex items-center gap-3">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: rank.color, boxShadow: `0 0 10px ${rank.color}66` }} />
                      <div>
                        <p className="text-sm font-semibold text-white">{rank.name} {tier}</p>
                        <p className="text-[11px] text-muted">{minRhp.toLocaleString()} RHP</p>
                      </div>
                    </div>
                    {active && <span className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: rank.color }}>You</span>}
                  </div>
                );
              })}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
