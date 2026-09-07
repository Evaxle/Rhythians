import { CircleAlert, Trophy } from "lucide-react";
import { rankLabel } from "@/lib/ranks";
import { getRbpProfile } from "@/lib/rbp";
import { RankIcon } from "@/components/rank-icon";

export async function RbpProfileCard({ userId, className = "" }: { userId: string; className?: string }) {
  let data: Awaited<ReturnType<typeof getRbpProfile>> = null;
  try {
    data = await getRbpProfile(userId);
  } catch {
    return <section className={`rounded-3xl border border-amber-400/20 bg-amber-400/[0.055] p-5 ${className}`}><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-amber-200"><CircleAlert size={14} /> Battle points unavailable</p><p className="mt-2 text-sm leading-6 text-muted">The RBP season data could not be loaded right now. The rest of this profile is still available.</p></section>;
  }
  if (!data) return <section className={`rounded-3xl border border-white/10 bg-black/15 p-5 ${className}`}><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-muted"><Trophy size={14} /> Rhythian Battle Points</p><p className="mt-2 text-sm text-muted">No active battle season is available.</p></section>;
  const next = data.rank.nextRankStart;
  const remaining = next == null ? 0 : Math.max(0, next - data.player.rbp);
  return <section className={`rounded-3xl border border-rose-400/20 bg-[linear-gradient(145deg,rgba(244,63,94,0.09),rgba(20,27,45,0.78))] p-5 shadow-glow ${className}`}><div className="flex items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-rose-300"><Trophy size={14} /> Rhythian Battle Points</p><div className="mt-2 flex flex-wrap items-end gap-x-5 gap-y-1"><p className="text-3xl font-black tabular-nums text-white">{data.player.rbp.toLocaleString()} <span className="text-sm font-semibold text-rose-200">RBP</span></p><p className="text-lg font-semibold" style={{ color: data.rank.color }}>{rankLabel(data.rank)}</p></div><p className="mt-1 text-xs text-muted">Season battle rating, kept separate from normal RHP.</p></div><RankIcon rank={data.rank} size={58} /></div><div className="mt-5"><div className="flex items-center justify-between text-xs text-muted"><span>Progress to next rank</span><span>{next == null ? "MAX" : `${remaining.toLocaleString()} RBP to go`}</span></div><div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${next == null ? 100 : Math.max(3, data.rank.progressToNextTier * 100)}%`, background: `linear-gradient(90deg, ${data.rank.color}88, ${data.rank.color})` }} /></div><div className="mt-2 flex justify-between text-[11px] text-muted"><span>Placement: {RBPPlacementLabel(data.player.placementRankIndex)}</span><span>{data.rank.isExpert ? "Expert" : `${data.rank.name} ${data.rank.tier}`}</span></div></div></section>;
}

function RBPPlacementLabel(index: number) {
  const names = ["Copper", "Bronze", "Silver", "Gold", "Platinum", "Emerald", "Diamond", "Master", "Expert"];
  return names[Math.max(0, Math.min(names.length - 1, index))] ?? "Copper";
}
