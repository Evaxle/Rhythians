import { getRankInfo, type RankInfo } from "@/lib/ranks";
import type { ModeKey } from "@/lib/rhythia-mode-rules";

export function modeRankInfo(points: number, _mode: ModeKey): RankInfo {
  return getRankInfo(Math.max(0, Math.floor(points)));
}

export function modeRankLabel(points: number, mode: ModeKey) {
  const info = modeRankInfo(points, mode);
  return info.isExpert ? "Expert" : `${info.name} ${info.tier}`;
}
