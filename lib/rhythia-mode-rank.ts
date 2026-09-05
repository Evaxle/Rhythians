import { RANKS, type RankInfo } from "@/lib/ranks";
import { MODE_RULES, type ModeKey } from "@/lib/rhythia-mode-rules";

export function modeRankInfo(points: number, mode: ModeKey): RankInfo {
  const rule = MODE_RULES[mode];
  const safe = Math.max(0, Math.floor(points));
  const rankSpan = rule.tierSpan * 5;
  const index = Math.min(RANKS.length - 1, Math.floor(safe / rankSpan));
  const rank = RANKS[index];
  const within = safe - index * rankSpan;
  const tier = Math.min(5, Math.floor(within / rule.tierSpan) + 1);
  const tierStart = index * rankSpan + Math.min(4, Math.floor(within / rule.tierSpan)) * rule.tierSpan;
  const tierEnd = Math.min(tierStart + rule.tierSpan, index * rankSpan + rankSpan);
  const nextTierStart = Math.min(index * rankSpan + tier * rule.tierSpan, index * rankSpan + rankSpan);
  const progressToNextTier = Math.min(1, Math.max(0, (safe - tierStart) / rule.tierSpan));
  const nextRankStart = index < RANKS.length - 1 ? (index + 1) * rankSpan : null;
  return { index, name: rank.name, tier, isExpert: index === RANKS.length - 1, minRhp: index * rankSpan, maxRhp: index < RANKS.length - 1 ? (index + 1) * rankSpan : null, tierStart, tierEnd, nextTierStart, nextRankStart, color: rank.color, progressToNextTier, rangeMin: rank.rangeMin, rangeMax: rank.rangeMax };
}

export function modeRankLabel(points: number, mode: ModeKey) {
  const info = modeRankInfo(points, mode);
  return info.isExpert ? "Expert" : `${info.name} ${info.tier}`;
}
