export const MODE_RULES = {
  lock: { key: "lock", label: "Lock", short: "RPL", rewardMultiplier: 1, maxPoints: 1000000, rankScale: 1 },
  spin: { key: "spin", label: "Spin", short: "RPS", rewardMultiplier: 1.12, maxPoints: 1000000, rankScale: 1 },
  vr: { key: "vr", label: "VR", short: "RPV", rewardMultiplier: 1.06, maxPoints: 1000000, rankScale: 1 },
} as const;

export type ModeKey = keyof typeof MODE_RULES;
export type ModePoints = { lock: number; spin: number; vr: number };
