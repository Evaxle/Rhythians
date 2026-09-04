export const MODE_RULES = {
  lock: { key: "lock", label: "Lock", short: "RPL", maxPoints: 25, tierSpan: 100 },
  spin: { key: "spin", label: "Spin", short: "RPS", maxPoints: 30, tierSpan: 90 },
  vr: { key: "vr", label: "VR", short: "RPV", maxPoints: 23, tierSpan: 92 },
} as const;

export type ModeKey = keyof typeof MODE_RULES;
export type ModePoints = { lock: number; spin: number; vr: number };
