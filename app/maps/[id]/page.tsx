import Link from "next/link";
import { Archive, Link2, LogIn } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSessionUser, hasPermission, isOwner } from "@/lib/auth";
import { getRankInfo } from "@/lib/ranks";
import { getRankedMapDetail } from "@/lib/ranked-map-leaderboard";
import { MapDetail } from "@/components/maps/map-detail";
import { MapRankingControls } from "@/components/maps/map-ranking-controls";
import { CopyMapId } from "@/components/copy-map-id";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function RankedMapPage({ params }: Props) {
  const user = await getSessionUser();
  if (!user) return <div className="mx-auto max-w-2xl"><section className="rounded-3xl border border-border bg-surface/95 p-10 text-center shadow-glow"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent"><LogIn size={26} /></div><h1 className="mt-5 text-2xl font-semibold text-white">Sign in to view this map</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">Link your Rhythia account to view score information and analyzed map details.</p><Link href="/login" className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent2"><LogIn size={16} /> Sign in</Link></section></div>;

  const { id } = await params;
  const [map, userRow] = await Promise.all([getRankedMapDetail(id), prisma.user.findUnique({ where: { id: user.id }, select: { rhp: true } })]);
  if (!map) return <div className="mx-auto max-w-2xl"><section className="rounded-3xl border border-border bg-surface/95 p-10 text-center shadow-glow"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent"><Link2 size={26} /></div><h1 className="mt-5 text-2xl font-semibold text-white">Map details unavailable</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">Difficulty timeline details are available for analyzed ranked and legacy Rhythia maps only.</p><Link href="/maps" className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent2">Back to maps</Link></section></div>;

  const userRank = getRankInfo(userRow?.rhp ?? 0);
  const canRank = hasPermission(user, "clips_moderate") || hasPermission(user, "admin_access") || isOwner(user);
  return <div className="mx-auto max-w-6xl space-y-4">
    {map.isLegacy ? <div className="rounded-2xl border border-white/15 bg-white/[0.045] p-4 text-sm text-white"><div className="flex flex-wrap items-center justify-between gap-3"><span className="flex items-center gap-2"><Archive size={16} className="text-accent" /> Legacy Rhythia map — analyzed for difficulty/timeline reference, but it does not award RPL, RPV, RPS, or RHP.</span><CopyMapId mapId={map.mapId} /></div></div> : <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200"><div className="flex flex-wrap items-center justify-between gap-3"><span>Ranked map — this map is eligible to award RHP and its analysis timeline determines the displayed rating.</span><CopyMapId mapId={map.mapId} /></div></div>}
    {!map.isRanked && !map.isLegacy && <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200"><MapRankingControls mapId={map.mapId} canRank={canRank} /></div>}
    <MapDetail map={map} userRank={userRank} currentUserId={user.id} />
  </div>;
}
