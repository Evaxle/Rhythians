export type RankDefinition = {
  index: number;
  name: string;
  minRhp: number;
  color: string;
  rangeMin: number;
  rangeMax: number;
};

export const RANKS: RankDefinition[] = [
  { index: 0, name: "Copper", minRhp: 0, color: "#b87333", rangeMin: 0, rangeMax: 2.49 },
  { index: 1, name: "Bronze", minRhp: 600, color: "#cd7f32", rangeMin: 2.5, rangeMax: 3.19 },
  { index: 2, name: "Silver", minRhp: 1600, color: "#c0c0c0", rangeMin: 3.2, rangeMax: 3.69 },
  { index: 3, name: "Gold", minRhp: 3100, color: "#ffd700", rangeMin: 3.7, rangeMax: 4.19 },
  { index: 4, name: "Platinum", minRhp: 5150, color: "#7fd4ff", rangeMin: 4.2, rangeMax: 4.69 },
  { index: 5, name: "Emerald", minRhp: 7850, color: "#50c878", rangeMin: 4.7, rangeMax: 5.19 },
  { index: 6, name: "Diamond", minRhp: 11300, color: "#b9f2ff", rangeMin: 5.2, rangeMax: 5.69 },
  { index: 7, name: "Master", minRhp: 15550, color: "#a855f7", rangeMin: 5.7, rangeMax: 6.19 },
  { index: 8, name: "Expert", minRhp: 20750, color: "#f43f5e", rangeMin: 6.2, rangeMax: 99 },
];

export const RANK_TIERS = 5;
export const RANK_SPAN = 0;
export const TIER_SPAN = 0;
export const MAP_RHP_FLOOR = 12;
export const MAP_RHP_CEILING = 1000000;

export type RankInfo = {
  index: number;
  name: string;
  tier: number;
  isExpert: boolean;
  minRhp: number;
  maxRhp: number | null;
  tierStart: number;
  tierEnd: number;
  nextTierStart: number;
  nextRankStart: number | null;
  color: string;
  progressToNextTier: number;
  rangeMin: number;
  rangeMax: number;
};

export function rankTierBounds(rankIndex: number, tier: number) {
  const index = Math.max(0, Math.min(RANKS.length - 1, Math.floor(rankIndex)));
  const rank = RANKS[index];
  if (index === RANKS.length - 1) return { start: rank.minRhp, end: Number.POSITIVE_INFINITY };
  const safeTier = Math.max(1, Math.min(RANK_TIERS, Math.floor(tier)));
  const next = RANKS[index + 1].minRhp;
  const span = next - rank.minRhp;
  const start = rank.minRhp + Math.floor(span * (safeTier - 1) / RANK_TIERS);
  const end = safeTier === RANK_TIERS ? next : rank.minRhp + Math.floor(span * safeTier / RANK_TIERS);
  return { start, end };
}

export function getRankInfo(rhp: number): RankInfo {
  const safe = Math.max(0, Math.floor(rhp));
  let index = 0;
  for (let i = RANKS.length - 1; i >= 0; i -= 1) {
    if (safe >= RANKS[i].minRhp) {
      index = i;
      break;
    }
  }
  const rank = RANKS[index];
  const isExpert = index === RANKS.length - 1;
  const nextRankStart = isExpert ? null : RANKS[index + 1].minRhp;
  if (isExpert) return { index, name: rank.name, tier: 1, isExpert: true, minRhp: rank.minRhp, maxRhp: null, tierStart: rank.minRhp, tierEnd: Number.POSITIVE_INFINITY, nextTierStart: rank.minRhp, nextRankStart: null, color: rank.color, progressToNextTier: 1, rangeMin: rank.rangeMin, rangeMax: rank.rangeMax };
  const span = nextRankStart! - rank.minRhp;
  const within = safe - rank.minRhp;
  const tier = Math.min(RANK_TIERS, Math.floor(within * RANK_TIERS / Math.max(1, span)) + 1);
  const bounds = rankTierBounds(index, tier);
  const progressToNextTier = Math.min(1, Math.max(0, (safe - bounds.start) / Math.max(1, bounds.end - bounds.start)));
  return { index, name: rank.name, tier, isExpert: false, minRhp: rank.minRhp, maxRhp: nextRankStart, tierStart: bounds.start, tierEnd: bounds.end, nextTierStart: bounds.end, nextRankStart, color: rank.color, progressToNextTier, rangeMin: rank.rangeMin, rangeMax: rank.rangeMax };
}

export function isMapInRankRange(rating: number, rankIndex: number) {
  const rank = RANKS[rankIndex] ?? RANKS[RANKS.length - 1];
  return rating >= rank.rangeMin && rating <= rank.rangeMax;
}

export function rankIndexForRating(rating: number) {
  const safe = Math.max(0, rating);
  const index = RANKS.findIndex((rank) => safe >= rank.rangeMin && safe <= rank.rangeMax);
  return index === -1 ? RANKS.length - 1 : index;
}

export function mapTierForRating(rating: number) {
  const index = rankIndexForRating(rating);
  if (index === RANKS.length - 1) return 1;
  const rank = RANKS[index];
  const width = Math.max(0.01, rank.rangeMax - rank.rangeMin + 0.01);
  const progress = Math.min(0.999999, Math.max(0, (rating - rank.rangeMin) / width));
  return Math.min(RANK_TIERS, Math.floor(progress * RANK_TIERS) + 1);
}

export function roundRating(value: number) { return Math.round(value * 100) / 100; }
export function fairRatingFromStars(stars: number) { return roundRating(Math.max(0, stars) * 0.41); }

export function difficultyFactorForRating(rating: number, rankIndex?: number) {
  const index = rankIndex ?? rankIndexForRating(rating);
  const rank = RANKS[index] ?? RANKS[0];
  const span = Math.max(0.01, rank.rangeMax - rank.rangeMin);
  return Math.min(1, Math.max(0, (rating - rank.rangeMin) / span));
}

export function baseRhpForRating(rating: number) {
  const r = Math.max(0, rating);
  return 12 + 8 * r + 1.5 * r * r;
}

export function lengthMultiplier(_lengthSeconds: number | null | undefined) { return 1; }
export function accuracyMultiplier(_accuracy: number) { return 1; }
export function speedMultiplier(speed: number | null | undefined) { return speed == null || !Number.isFinite(speed) || speed <= 0 ? 1 : Math.max(0.5, Math.min(2, speed)); }

export function rhpGainForMap(rating: number, _accuracy: number | null, speed?: number | null, _rankIndex?: number, _lengthSeconds?: number | null) {
  const adjusted = Math.max(0, rating) * Math.pow(speedMultiplier(speed), 1.15);
  return Math.max(1, Math.round(baseRhpForRating(adjusted)));
}

export function rhpLossForMap(_rating: number, _context: { totalBeaters: number; yourPlace: number }) { return 0; }

export function accuracyFromMisses(notes: number | null, misses: number | null) {
  if (!notes || notes <= 0 || misses == null) return null;
  return Math.max(0, Math.min(100, ((notes - misses) / notes) * 100));
}

export function rankLabel(info: RankInfo) { return info.isExpert ? "Expert" : `${info.name} ${info.tier}`; }
export function describeRatingRange(rating: number) { return RANKS[rankIndexForRating(rating)]?.name ?? "Expert"; }
