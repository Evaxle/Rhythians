import { RANKS, getRankInfo, type RankInfo } from "@/lib/ranks";
import { RankIcon } from "@/components/rank-icon";

export function RankBadge({
  rank,
  globalRank,
  size = "md",
  showTier = true,
}: {
  rank: RankInfo;
  globalRank?: number | null;
  size?: "sm" | "md" | "lg";
  showTier?: boolean;
}) {
  const sizeClass = size === "lg" ? "px-4 py-1.5 text-base gap-2" : size === "sm" ? "px-2 py-0.5 text-[11px] gap-1" : "px-3 py-1 text-sm gap-1.5";
  const iconSize = size === "lg" ? 34 : size === "sm" ? 22 : 28;
  const label = rank.isExpert ? "Expert" : `${rank.name} ${rank.tier}`;
  const sub = rank.isExpert && globalRank != null ? ` #${globalRank.toLocaleString()}` : "";

  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold ${sizeClass}`}
      style={{ color: rank.color, borderColor: `${rank.color}55`, backgroundColor: `${rank.color}1a` }}
      title={`${label}${sub} · ${rank.minRhp.toLocaleString()} RHP`}
    >
      <RankIcon rank={rank} size={iconSize} />
      <span>
        {label}
        {sub}
      </span>
      {!rank.isExpert && showTier && (
        <span className="opacity-70" title={`Tier ${rank.tier} of 5`}>
          · {rank.tier}/5
        </span>
      )}
    </span>
  );
}

export function RankRow({ rankIndex, className }: { rankIndex: number; className?: string }) {
  const rank = RANKS[rankIndex] ?? RANKS[RANKS.length - 1];
  const rankInfo = getRankInfo(rank.minRhp);

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ${className ?? ""}`}
      style={{ color: rank.color, borderColor: `${rank.color}55`, backgroundColor: `${rank.color}1a` }}
    >
      <RankIcon rank={rankInfo} size={28} />
      {rank.name}
    </span>
  );
}
