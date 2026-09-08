import { RANKS, RANK_TIERS, type RankInfo } from "@/lib/ranks";
import { MODE_RULES, type ModeKey } from "@/lib/rhythia-mode-rules";

function scaledRankStart(index: number, mode: ModeKey) {
  return Math.round(RANKS[index].minRhp * MODE_RULES[mode].rankScale);
}

export function modeRankInfo(points: number, mode: ModeKey): RankInfo {
  const safe = Math.max(0, Math.floor(points));
  let index = RANKS.length - 1;
  for (let i = RANKS.length - 1; i >= 0; i -= 1) {
    if (safe >= scaledRankStart(i, mode)) {
      index = i;
      break;
    }
  }
  const rank = RANKS[index];
  const min = scaledRankStart(index, mode);
  const isExpert = index === RANKS.length - 1;
  if (isExpert) {
    return {
      index,
      name: rank.name,
      tier: 1,
      isExpert: true,
      minRhp: min,
      maxRhp: null,
      tierStart: min,
      tierEnd: Number.POSITIVE_INFINITY,
      nextTierStart: min,
      nextRankStart: null,
      color: rank.color,
      progressToNextTier: 1,
      rangeMin: rank.rangeMin,
      rangeMax: rank.rangeMax,
    };
  }
  const next = scaledRankStart(index + 1, mode);
  const span = Math.max(1, next - min);
  const within = safe - min;
  const tier = Math.min(RANK_TIERS, Math.floor(within * RANK_TIERS / span) + 1);
  const tierStart = min + Math.floor(span * (tier - 1) / RANK_TIERS);
  const tierEnd = tier === RANK_TIERS ? next : min + Math.floor(span * tier / RANK_TIERS);
  const progressToNextTier = Math.min(1, Math.max(0, (safe - tierStart) / Math.max(1, tierEnd - tierStart)));
  return {
    index,
    name: rank.name,
    tier,
    isExpert: false,
    minRhp: min,
    maxRhp: next,
    tierStart,
    tierEnd,
    nextTierStart: tierEnd,
    nextRankStart: next,
    color: rank.color,
    progressToNextTier,
    rangeMin: rank.rangeMin,
    rangeMax: rank.rangeMax,
  };
}

export function modeRankLabel(points: number, mode: ModeKey) {
  const info = modeRankInfo(points, mode);
  return info.isExpert ? "Expert" : `${info.name} ${info.tier}`;
}
