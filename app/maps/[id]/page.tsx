import Link from "next/link";
import { Archive, Link2, LogIn, Settings2, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSessionUser, hasPermission, isOwner } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { getRankInfo } from "@/lib/ranks";
import { getRankedMapDetail } from "@/lib/ranked-map-leaderboard";
import { MapDetail } from "@/components/maps/map-detail";
import { MapRankingControls } from "@/components/maps/map-ranking-controls";
import { CopyMapId } from "@/components/copy-map-id";
import { AdminMapControls, type ChallengeAdminTab } from "@/components/challenge/admin-map-controls";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function RankedMapPage({ params }: Props) {
  const user = await getSessionUser();

  if (!user) {
    return <div className="mx-auto max-w-2xl"><section className="rounded-3xl border border-border bg-surface/95 p-10 text-center shadow-glow">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent"><LogIn size={26} /></div>
      <h1 className="mt-5 text-2xl font-semibold text-white">Sign in to view this map</h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">Link your Rhythia account to view raw-map difficulty, Rankability v5, Challenge Fit v2, and score information.</p>
      <Link href="/login" className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent2"><LogIn size={16} /> Sign in</Link>
    </section></div>;
  }

  const { id } = await params;
  const [map, userRow, isAdmin] = await Promise.all([
    getRankedMapDetail(id),
    prisma.user.findUnique({ where: { id: user.id }, select: { rhp: true } }),
    canAccessAdmin(user),
  ]);

  if (!map) {
    return <div className="mx-auto max-w-2xl"><section className="rounded-3xl border border-border bg-surface/95 p-10 text-center shadow-glow">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent"><Link2 size={26} /></div>
      <h1 className="mt-5 text-2xl font-semibold text-white">Map details unavailable</h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">This ranked, unranked, or legacy map needs to finish the current raw-map analysis version before its difficulty, rankability, and Challenge Fit details can be shown.</p>
      <Link href="/maps" className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent2">Back to maps</Link>
    </section></div>;
  }

  const userRank = getRankInfo(userRow?.rhp ?? 0);
  const canRank = hasPermission(user, "clips_moderate") || hasPermission(user, "admin_access") || isOwner(user);
  const assignment = map.challengeAssignments[0];
  const currentTab = (assignment?.category ?? "challenge") as ChallengeAdminTab;
  const currentLevel = assignment?.level ?? 1;

  return <div className="mx-auto max-w-6xl space-y-4">
    {map.isLegacy
      ? <div className="rounded-2xl border border-white/15 bg-white/[0.045] p-4 text-sm text-white"><div className="flex flex-wrap items-center justify-between gap-3"><span className="flex items-center gap-2"><Archive size={16} className="text-accent" /> Legacy map — Difficulty v5, Rankability v5, Challenge Fit v2, and category progression remain available; rank points stay disabled.</span><CopyMapId mapId={map.mapId} /></div></div>
      : map.isRanked
        ? <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200"><div className="flex flex-wrap items-center justify-between gap-3"><span>Ranked map — current raw-map analysis drives its difficulty, rewards, rankability, timeline, and Challenge/category recommendations.</span><CopyMapId mapId={map.mapId} /></div></div>
        : <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200"><div className="flex flex-wrap items-center justify-between gap-3"><span>Unranked map — analyzed with the same raw-map v5 engine for difficulty, rankability, and Challenge/category placement, without automatic RHP eligibility.</span><CopyMapId mapId={map.mapId} /></div></div>}

    {!map.isRanked && !map.isLegacy && <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200"><MapRankingControls mapId={map.mapId} canRank={canRank} /></div>}

    {isAdmin && <section className="rounded-3xl border border-amber-300/20 bg-amber-300/[0.05] p-5 shadow-glow">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">Admin map management</p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Assign this source map to Challenge, Jumps, Stream, Tech, Off Grid, or Vibro at Levels 1–10. The unified Manage Maps page also contains the v5 analyzers and category manager.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/maps" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white"><Plus size={14} /> Manage maps + analysis</Link>
          <Link href="/admin/challenge" className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-xs font-semibold text-white"><Settings2 size={14} /> Challenge manager</Link>
        </div>
      </div>
      <AdminMapControls mapId={map.mapId} currentTab={currentTab} currentLevel={currentLevel} />
    </section>}

    <MapDetail map={map} userRank={userRank} currentUserId={user.id} />
  </div>;
}
