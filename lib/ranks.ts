export type RankDefinition = {
  index: number;
  name: string;
  minRhp: number;
  color: string;
  rangeMin: number;
  rangeMax: number;
};

export const RANKS: RankDefinition[] = [
  { index: 0, name: "Copper", minRhp: 0, color: "#b87333", rangeMin: 0.0, rangeMax: 1.49 },
  { index: 1, name: "Bronze", minRhp: 500, color: "#cd7f32", rangeMin: 1.5, rangeMax: 1.99 },
  { index: 2, name: "Silver", minRhp: 1000, color: "#c0c0c0", rangeMin: 2.0, rangeMax: 2.49 },
  { index: 3, name: "Gold", minRhp: 1500, color: "#ffd700", rangeMin: 2.5, rangeMax: 2.99 },
  { index: 4, name: "Platinum", minRhp: 2000, color: "#7fd4ff", rangeMin: 3.0, rangeMax: 3.49 },
  { index: 5, name: "Emerald", minRhp: 2500, color: "#50c878", rangeMin: 3.5, rangeMax: 3.99 },
  { index: 6, name: "Diamond", minRhp: 3000, color: "#b9f2ff", rangeMin: 4.0, rangeMax: 4.49 },
  { index: 7, name: "Master", minRhp: 3500, color: "#a855f7", rangeMin: 4.5, rangeMax: 4.99 },
  { index: 8, name: "Expert", minRhp: 4000, color: "#f43f5e", rangeMin: 5.0, rangeMax: 9.99 },
];

export const RANK_TIERS = 5;
export const RANK_SPAN = 500;
export const TIER_SPAN = 100;

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

export function getRankInfo(rhp: number): RankInfo {
  const safe = Math.max(0, Math.floor(rhp));
  const index = Math.min(RANKS.length - 1, Math.floor(safe / RANK_SPAN));
  const rank = RANKS[index];
  const within = safe - rank.minRhp;
  const tier = Math.min(RANK_TIERS, Math.floor(within / TIER_SPAN) + 1);
  const tierStart = rank.minRhp + (tier - 1) * TIER_SPAN;
  const tierEnd = Math.min(tierStart + TIER_SPAN, rank.minRhp + RANK_SPAN);
  const nextTierStart = Math.min(rank.minRhp + tier * TIER_SPAN, rank.minRhp + RANK_SPAN);
  const progressToNextTier = Math.min(1, Math.max(0, (safe - tierStart) / TIER_SPAN));
  const nextRankStart = index < RANKS.length - 1 ? RANKS[index + 1].minRhp : null;

  return {
    index,
    name: rank.name,
    tier,
    isExpert: index === RANKS.length - 1,
    minRhp: rank.minRhp,
    maxRhp: index < RANKS.length - 1 ? rank.minRhp + RANK_SPAN : null,
    tierStart,
    tierEnd,
    nextTierStart,
    nextRankStart,
    color: rank.color,
    progressToNextTier,
    rangeMin: rank.rangeMin,
    rangeMax: rank.rangeMax,
  };
}

export function isMapInRankRange(rating: number, rankIndex: number): boolean {
  const rank = RANKS[rankIndex] ?? RANKS[RANKS.length - 1];
  return rating >= rank.rangeMin && rating <= rank.rangeMax;
}

export function roundRating(value: number): number {
  return Math.round(value * 100) / 100;
}

export function fairRatingFromStars(stars: number): number {
  return roundRating(stars * 0.41);
}

// Maximum base RHP for beating a map at 100% accuracy with no modifiers, per rank.
// Higher ranks award slightly less so climbing stays balanced and harder maps
// aren't worth dramatically more than easier ones:
//   Copper 20 · Bronze 19 · Silver 18 · Gold 17 · Platinum 16
//   Emerald 15 · Diamond 14 · Master 13 · Expert 10
export function maxRhpForRank(rankIndex: number): number {
  if (rankIndex >= RANKS.length - 1) return 10;
  return Math.max(10, 20 - rankIndex);
}

export function accuracyMultiplier(accuracy: number): number {
  if (accuracy >= 100) return 1.0;
  if (accuracy >= 99) return 0.9;
  if (accuracy >= 98) return 0.75;
  if (accuracy >= 95) return 0.6;
  if (accuracy >= 90) return 0.5;
  return 0.4;
}

// Playing with a speed modifier rewards a small bonus. A 2.00x run is worth
// 1.25x the base RHP; capped so it can never be farmed at extreme speeds.
export function speedMultiplier(speed: number | null | undefined): number {
  if (speed == null || !Number.isFinite(speed) || speed <= 1.001) return 1;
  return Math.min(1.5, 1 + (speed - 1) * 0.25);
}

export function rhpGainForMap(rating: number, accuracy: number | null, speed?: number | null, rankIndex?: number): number {
  const base = maxRhpForRank(rankIndex ?? 0);
  const multiplier = (accuracy == null ? 1 : accuracyMultiplier(accuracy)) * speedMultiplier(speed);
  return Math.max(5, Math.round(base * multiplier));
}

// Failing a challenge map costs RHP based on how many people have beaten the
// map and the position your failed attempt would have placed on it. The better
// your attempt was (higher placement), the less you lose. If you have no
// recorded accuracy your placement is treated as last, so you take the full loss.
export function rhpLossForMap(rating: number, context: { totalBeaters: number; yourPlace: number }): number {
  const base = Math.max(5, Math.round(rating * 10));
  if (context.totalBeaters <= 0) return base;
  const ahead = Math.max(0, context.yourPlace - 1);
  const ratio = Math.min(1, ahead / context.totalBeaters);
  return Math.round(base * ratio);
}

export function accuracyFromMisses(notes: number | null, misses: number | null): number | null {
  if (!notes || notes <= 0 || misses == null) return null;
  return Math.max(0, Math.min(100, ((notes - misses) / notes) * 100));
}

export function rankLabel(info: RankInfo): string {
  if (info.isExpert) return "Expert";
  return `${info.name} ${info.tier}`;
}

export function describeRatingRange(rating: number): string {
  const matched = RANKS.find((rank) => rating >= rank.rangeMin && rating <= rank.rangeMax);
  return matched?.name ?? (rating > RANKS[RANKS.length - 1].rangeMax ? RANKS[RANKS.length - 1].name : RANKS[0].name);
}