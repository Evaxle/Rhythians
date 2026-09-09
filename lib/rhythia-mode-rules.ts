export const MODE_RULES = {
  lock: { key: "lock", label: "Lock", short: "RPL", maxPoints: 26, rankScale: 0.35 },
  spin: { key: "spin", label: "Spin", short: "RPS", maxPoints: 24, rankScale: 0.32 },
  vr: { key: "vr", label: "VR", short: "RPV", maxPoints: 23, rankScale: 0.3 },
} as const;

export type ModeKey = keyof typeof MODE_RULES;
export type ModePoints = { lock: number; spin: number; vr: number };
