import { getRankInfo, type RankInfo } from "@/lib/ranks";
import { MODE_RULES, type ModeKey } from "@/lib/rhythia-mode-rules";

function scaled(value: number, scale: number) { return Number.isFinite(value) ? Math.round(value * scale) : value; }

export function modeRankInfo(points: number, mode: ModeKey): RankInfo {
  const scale = MODE_RULES[mode].rankScale;
  const safe = Math.max(0, Math.floor(points));
  const base = getRankInfo(safe / scale);
  const minRhp = scaled(base.minRhp, scale);
  const maxRhp = base.maxRhp == null ? null : scaled(base.maxRhp, scale);
  const tierStart = scaled(base.tierStart, scale);
  const tierEnd = scaled(base.tierEnd, scale);
  const nextTierStart = scaled(base.nextTierStart, scale);
  const nextRankStart = base.nextRankStart == null ? null : scaled(base.nextRankStart, scale);
  const progressToNextTier = base.isExpert ? 1 : Math.min(1, Math.max(0, (safe - tierStart) / Math.max(1, tierEnd - tierStart)));
  return { ...base, minRhp, maxRhp, tierStart, tierEnd, nextTierStart, nextRankStart, progressToNextTier };
}

export function modeRankLabel(points: number, mode: ModeKey) {
  const info = modeRankInfo(points, mode);
  return info.isExpert ? "Expert" : `${info.name} ${info.tier}`;
}
