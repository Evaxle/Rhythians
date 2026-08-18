import { RANKS, type RankInfo } from "@/lib/ranks";

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
  const dotClass = size === "lg" ? "h-3 w-3" : size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5";

  const label = rank.isExpert ? "Expert" : `${rank.name} ${rank.tier}`;
  const sub = rank.isExpert && globalRank != null ? ` #${globalRank.toLocaleString()}` : "";

  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold ${sizeClass}`}
      style={{ color: rank.color, borderColor: `${rank.color}55`, backgroundColor: `${rank.color}1a` }}
      title={`${label}${sub} · ${rank.minRhp.toLocaleString()} RHP`}
    >
      <span className={`rounded-full ${dotClass}`} style={{ backgroundColor: rank.color }} />
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
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ${className ?? ""}`}
      style={{ color: rank.color, borderColor: `${rank.color}55`, backgroundColor: `${rank.color}1a` }}
    >
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: rank.color }} />
      {rank.name}
    </span>
  );
}