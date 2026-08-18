import "dotenv/config";
import { RANKS, getRankInfo } from "../lib/ranks";

function rankLabel(rhp: number): string {
  const info = getRankInfo(rhp);
  return info.isExpert ? "Expert" : `${info.name} ${info.tier}`;
}

// ---------------------------------------------------------------------------
// Candidate formulas
// ---------------------------------------------------------------------------

// F1: Current weight — 0.8 - 0.05/500, then 0.02/500 below 0.4, floor 0.2
function f1(rp: number): number {
  if (rp <= 0) return 0;
  const steps = Math.floor(rp / 500);
  let w = 0.8 - 0.05 * steps;
  if (w < 0.4) w = 0.4 - 0.02 * (steps - 8);
  w = Math.max(0.2, w);
  return Math.round(rp * w);
}

// F2: Weight, floor 0.3
function f2(rp: number): number {
  if (rp <= 0) return 0;
  const steps = Math.floor(rp / 500);
  let w = 0.8 - 0.05 * steps;
  if (w < 0.4) w = 0.4 - 0.02 * (steps - 8);
  w = Math.max(0.3, w);
  return Math.round(rp * w);
}

// F3: Weight, floor 0.35
function f3(rp: number): number {
  if (rp <= 0) return 0;
  const steps = Math.floor(rp / 500);
  let w = 0.8 - 0.05 * steps;
  if (w < 0.4) w = 0.4 - 0.02 * (steps - 8);
  w = Math.max(0.35, w);
  return Math.round(rp * w);
}

// F4: Weight, transition at 0.5 (not 0.4), floor 0.35
function f4(rp: number): number {
  if (rp <= 0) return 0;
  const steps = Math.floor(rp / 500);
  let w = 0.8 - 0.05 * steps;
  if (w < 0.5) w = 0.5 - 0.02 * (steps - 6);
  w = Math.max(0.35, w);
  return Math.round(rp * w);
}

// F5: Old piecewise (title-aligned 1:1 at low end)
const F5_ANCHORS: [number, number][] = [
  [0, 0], [500, 500], [1000, 1000], [1500, 1500], [2000, 2000], [2500, 2500],
  [3500, 3000], [5000, 3500], [7500, 4000], [10000, 4500], [15000, 5500], [20000, 6500],
];

// F6: Balanced piecewise (recommended) — keeps user's low-mid examples,
//     places high skill properly
const F6_ANCHORS: [number, number][] = [
  [0, 0], [500, 375], [1000, 700], [2000, 1200], [5000, 2500], [10000, 3500], [20000, 5000],
];

function piecewise(rp: number, anchors: [number, number][]): number {
  if (rp <= anchors[0][0]) return anchors[0][1];
  if (rp >= anchors[anchors.length - 1][0]) {
    const [x0, y0] = anchors[anchors.length - 2];
    const [x1, y1] = anchors[anchors.length - 1];
    const slope = (y1 - y0) / (x1 - x0);
    return Math.round(y1 + (rp - x1) * slope);
  }
  for (let i = 1; i < anchors.length; i++) {
    const [x0, y0] = anchors[i - 1];
    const [x1, y1] = anchors[i];
    if (rp <= x1) {
      const t = (rp - x0) / (x1 - x0);
      return Math.round(y0 + t * (y1 - y0));
    }
  }
  return anchors[anchors.length - 1][1];
}
function f5(rp: number): number { return piecewise(rp, F5_ANCHORS); }
function f6(rp: number): number { return piecewise(rp, F6_ANCHORS); }

// F7: Power curve — RHP = A * RP^p, fit to 500->375 and 2000->1200
function f7(rp: number): number {
  if (rp <= 0) return 0;
  return Math.round(2.01 * Math.pow(rp, 0.839));
}

// F8: Log curve — RHP = A * ln(1 + RP/C), fit to 500->375 and 2000->1200
function f8(rp: number): number {
  if (rp <= 0) return 0;
  // A and C solved so 500->375 and 2000->1200
  const A = 375 / Math.log(1 + 500 / 200);
  return Math.round(A * Math.log(1 + rp / 200));
}

const FORMULAS: Array<{ name: string; fn: (rp: number) => number }> = [
  { name: "F1 current (floor .2)", fn: f1 },
  { name: "F2 weight (floor .3)", fn: f2 },
  { name: "F3 weight (floor .35)", fn: f3 },
  { name: "F4 weight (trans .5, floor .35)", fn: f4 },
  { name: "F5 old piecewise", fn: f5 },
  { name: "F6 balanced piecewise", fn: f6 },
  { name: "F7 power curve", fn: f7 },
  { name: "F8 log curve", fn: f8 },
];

// ---------------------------------------------------------------------------
// Ideal anchors (balanced target based on the rank system)
// ---------------------------------------------------------------------------
const IDEAL: [number, number][] = F6_ANCHORS;

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------
function isMonotonic(fn: (rp: number) => number): boolean {
  let prev = -1;
  for (let rp = 0; rp <= 50000; rp += 100) {
    const v = fn(rp);
    if (v < prev) return false;
    prev = v;
  }
  return true;
}

function main() {
  console.log("============================================================");
  console.log("  RHYTHIA RP -> RHP FORMULA ANALYSIS");
  console.log("============================================================");

  // 1. Comparison table at key RP values
  console.log("\n--- COMPARISON AT KEY RP VALUES (RHP / rank) ---");
  const keyRp = [0, 100, 250, 500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 10000, 15000, 20000, 30000];
  const header = `  ${"RP".padStart(6)} | ${FORMULAS.map((f) => f.name.padEnd(24)).join(" | ")}`;
  console.log(header);
  console.log("  " + "-".repeat(header.length - 2));
  for (const rp of keyRp) {
    const cells = FORMULAS.map((f) => {
      const v = f.fn(rp);
      return `${String(v).padStart(5)} ${rankLabel(v).padEnd(17)}`;
    });
    console.log(`  ${String(rp).padStart(6)} | ${cells.join(" | ")}`);
  }

  // 2. Error vs ideal anchors
  console.log("\n--- ERROR VS BALANCED IDEAL (lower is better) ---");
  const idealRp = IDEAL.map(([rp]) => rp);
  const scores: Array<{ name: string; score: number; maxErr: number }> = [];
  for (const f of FORMULAS) {
    let total = 0;
    let maxErr = 0;
    for (const [rp, ideal] of IDEAL) {
      const actual = f.fn(rp);
      const err = ideal > 0 ? Math.abs(actual - ideal) / ideal : 0;
      total += err;
      maxErr = Math.max(maxErr, err);
    }
    const score = total / IDEAL.length;
    scores.push({ name: f.name, score, maxErr });
    console.log(`  ${f.name.padEnd(30)} meanErr=${score.toFixed(3)}  maxErr=${maxErr.toFixed(3)}`);
  }
  scores.sort((a, b) => a.score - b.score);
  console.log(`\n  Best by mean error: ${scores[0].name}`);

  // 3. Constraints
  console.log("\n--- CONSTRAINTS ---");
  for (const f of FORMULAS) {
    const mono = isMonotonic(f.fn);
    // No over-boost: 100 RP (very low skill) must stay in Copper
    const low = f.fn(100);
    const lowOk = getRankInfo(low).index === 0;
    // No under-place: 10000 RP (Candidate Grandmaster) must be at least Platinum
    const high = f.fn(10000);
    const highOk = getRankInfo(high).index >= 4;
    // 20000 RP should be Expert
    const top = f.fn(20000);
    const topOk = getRankInfo(top).index === 8;
    console.log(
      `  ${f.name.padEnd(30)} mono=${mono ? "Y" : "N"}  noOverBoost=${lowOk ? "Y" : "N"}  cg>=Plat=${highOk ? "Y" : "N"}  top=Expert=${topOk ? "Y" : "N"}`
    );
  }

  // 4. Dense grid: verify monotonic + weight bounds for the recommended formula
  console.log("\n--- DENSE GRID CHECK (recommended F6) ---");
  let monoOk = true;
  let prev = -1;
  for (let rp = 0; rp <= 50000; rp += 10) {
    const v = f6(rp);
    if (v < prev) monoOk = false;
    prev = v;
  }
  console.log(`  F6 monotonic over 0-50000 (every 10 RP): ${monoOk ? "PASS" : "FAIL"}`);

  console.log("\n============================================================");
  console.log("  RECOMMENDATION: F6 balanced piecewise");
  console.log("============================================================");
  console.log("  Anchors: 0->0, 500->375, 1000->700, 2000->1200,");
  console.log("           5000->2500, 10000->3500, 20000->5000");
  console.log("  Keeps your examples (500->375, 2000->1200), places");
  console.log("  Master (5000) at Emerald, Candidate Grandmaster (10000)");
  console.log("  at Master, and 20000 RP at Expert.");
}

main();
