import { Trophy } from "lucide-react";
import { getRankInfo, rankLabel } from "@/lib/ranks";
import { getRbpProfile } from "@/lib/rbp";
import { RankIcon } from "@/components/rank-icon";

export async function RbpProfileCard({ userId }: { userId: string }) {
  const data = await getRbpProfile(userId);
  if (!data) return null;
  const next = data.rank.nextRankStart;
  const remaining = next == null ? 0 : Math.max(0, next - data.player.rbp);
  return <section className="rounded-3xl border border-rose-400/20 bg-[linear-gradient(145deg,rgba(244,63,94,0.09),rgba(20,27,45,0.78))] p-5 shadow-glow"><div className="flex items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-rose-300"><Trophy size={14} /> Rhythian Battle Points</p><div className="mt-2 flex flex-wrap items-end gap-x-5 gap-y-1"><p className="text-3xl font-black tabular-nums text-white">{data.player.rbp.toLocaleString()} <span className="text-sm font-semibold text-rose-200">RBP</span></p><p className="text-lg font-semibold" style={{ color: data.rank.color }}>{rankLabel(data.rank)}</p></div><p className="mt-1 text-xs text-muted">Placed one rank below your current RHP rank at the start of the season.</p></div><RankIcon rank={data.rank} size={58} /></div><div className="mt-5"><div className="flex items-center justify-between text-xs text-muted"><span>Progress to next rank</span><span>{next == null ? "MAX" : `${remaining.toLocaleString()} RBP to go`}</span></div><div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${next == null ? 100 : Math.max(3, data.rank.progressToNextTier * 100)}%`, background: `linear-gradient(90deg, ${data.rank.color}88, ${data.rank.color})` }} /></div><div className="mt-2 flex justify-between text-[11px] text-muted"><span>Placement: {RBPPlacementLabel(data.placementRankIndex)}</span><span>{data.rank.isExpert ? "Expert" : `${data.rank.name} ${data.rank.tier}`}</span></div></div></section>;
}

function RBPPlacementLabel(index: number) {
  const names = ["Copper","Bronze","Silver","Gold","Platinum","Emerald","Diamond","Master","Expert"];
  return names[Math.max(0, Math.min(names.length - 1, index))] ?? "Copper";
}
