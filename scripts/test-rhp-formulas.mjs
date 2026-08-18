// Temporary test harness — imports the REAL lib/ranks.ts and verifies the
// RHP formulas. Run with: node scripts/__test_ranks.mjs
import { RANKS, getRankInfo, rhpFromRhythiaRp, rhpGainForMap, difficultyFactorForRating, accuracyMultiplier, speedMultiplier, maxRhpForRank, rankIndexForRating } from "../lib/ranks.ts";

let failures = 0;
function check(label, ok) {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
}
function rankLabel(rhp) {
  const info = getRankInfo(rhp);
  return info.isExpert ? "Expert" : `${info.name} ${info.tier}`;
}

console.log("==============================================");
console.log("  RHYTHIANS RHP FUNCTIONALITY TESTS");
console.log("==============================================");

// --- 1. RP -> RHP formula (F2) ---
console.log("\n--- 1. RP → RHP (F2, floor 0.3) ---");
const rpValues = [0, 100, 250, 500, 750, 1000, 1250, 1500, 1750, 2000, 2250, 2500, 3000, 3500, 4000, 4500, 5000, 6000, 7000, 7500, 8000, 9000, 10000, 12500, 15000, 20000, 30000];
let prev = -1;
let mono = true;
for (const rp of rpValues) {
  const rhp = rhpFromRhythiaRp(rp);
  if (rhp < prev) mono = false;
  prev = rhp;
  console.log(`  ${String(rp).padStart(6)} RP → ${String(rhp).padStart(5)} RHP → ${rankLabel(rhp)}`);
}
check("Monotonic across full range", mono);
check("500 RP → 375 RHP", rhpFromRhythiaRp(500) === 375);
check("1000 RP → 700 RHP", rhpFromRhythiaRp(1000) === 700);
check("2000 RP → 1200 RHP", rhpFromRhythiaRp(2000) === 1200);
check("5000 RP → 1800 RHP", rhpFromRhythiaRp(5000) === 1800);
check("10000 RP → 3000 RHP", rhpFromRhythiaRp(10000) === 3000);
check("20000 RP → 6000 RHP", rhpFromRhythiaRp(20000) === 6000);
check("0 RP → 0 RHP", rhpFromRhythiaRp(0) === 0);
check("negative RP → 0 RHP", rhpFromRhythiaRp(-5) === 0);

// Weight bounds
let weightOk = true;
for (let rp = 0; rp <= 50000; rp += 100) {
  const rhp = rhpFromRhythiaRp(rp);
  const w = rp > 0 ? rhp / rp : 0.75;
  if (w > 0.8 + 1e-9 || w < 0.3 - 1e-9) weightOk = false;
}
check("Weight stays within [0.3, 0.8]", weightOk);

// --- 2. Skill placement ---
console.log("\n--- 2. SKILL PLACEMENT ---");
const placements = [
  [100, "Copper"], [500, "Copper"], [1000, "Bronze"], [1500, "Bronze"],
  [2000, "Silver"], [2500, "Silver"], [5000, "Gold"], [10000, "Diamond"], [20000, "Expert"],
];
for (const [rp, expected] of placements) {
  const info = getRankInfo(rhpFromRhythiaRp(rp));
  check(`${rp} RP → ${info.name} (expected ${expected})`, info.name === expected);
}

// --- 3. Per-map RHP (difficulty × accuracy × speed) ---
console.log("\n--- 3. RHP PER MAP ---");
console.log("  Rank      | easiest | mid | hardest");
for (const rank of RANKS) {
  const mid = (rank.rangeMin + rank.rangeMax) / 2;
  const easy = rhpGainForMap(rank.rangeMin, 100, null, rank.index);
  const midPts = rhpGainForMap(mid, 100, null, rank.index);
  const hard = rhpGainForMap(rank.rangeMax, 100, null, rank.index);
  console.log(`  ${rank.name.padEnd(10)} | ${String(easy).padStart(7)} | ${String(midPts).padStart(3)} | ${hard}`);
}

// Difficulty scaling within rank
for (const rank of RANKS) {
  const easy = rhpGainForMap(rank.rangeMin, 100, null, rank.index);
  const hard = rhpGainForMap(rank.rangeMax, 100, null, rank.index);
  check(`${rank.name}: hardest (${hard}) > easiest (${easy})`, hard > easy);
}

// Diminishing returns across ranks
let diminishing = true;
for (let i = 1; i < RANKS.length; i++) {
  const prevMid = (RANKS[i - 1].rangeMin + RANKS[i - 1].rangeMax) / 2;
  const curMid = (RANKS[i].rangeMin + RANKS[i].rangeMax) / 2;
  const prevPts = rhpGainForMap(prevMid, 100, null, RANKS[i - 1].index);
  const curPts = rhpGainForMap(curMid, 100, null, RANKS[i].index);
  if (curPts >= prevPts) diminishing = false;
}
check("Higher ranks earn less per map (diminishing)", diminishing);

// Accuracy scaling
const copperMid = (RANKS[0].rangeMin + RANKS[0].rangeMax) / 2;
const a100 = rhpGainForMap(copperMid, 100, null, 0);
const a99 = rhpGainForMap(copperMid, 99, null, 0);
const a98 = rhpGainForMap(copperMid, 98, null, 0);
const a95 = rhpGainForMap(copperMid, 95, null, 0);
const a90 = rhpGainForMap(copperMid, 90, null, 0);
const a80 = rhpGainForMap(copperMid, 80, null, 0);
check(`Accuracy: 100%(${a100}) > 99%(${a99}) > 98%(${a98}) > 95%(${a95}) > 90%(${a90}) > 80%(${a80})`, a100 > a99 && a99 > a98 && a98 > a95 && a95 > a90 && a90 > a80);
check("accuracyMultiplier(100) = 1.0", accuracyMultiplier(100) === 1.0);
check("accuracyMultiplier(99) = 0.9", accuracyMultiplier(99) === 0.9);
check("accuracyMultiplier(98) = 0.75", accuracyMultiplier(98) === 0.75);
check("accuracyMultiplier(95) = 0.6", accuracyMultiplier(95) === 0.6);
check("accuracyMultiplier(90) = 0.5", accuracyMultiplier(90) === 0.5);
check("accuracyMultiplier(80) = 0.4", accuracyMultiplier(80) === 0.4);

// Speed scaling
const s1 = rhpGainForMap(copperMid, 100, 1, 0);
const s15 = rhpGainForMap(copperMid, 100, 1.5, 0);
const s2 = rhpGainForMap(copperMid, 100, 2, 0);
const s3 = rhpGainForMap(copperMid, 100, 3, 0);
const s5 = rhpGainForMap(copperMid, 100, 5, 0);
check(`Speed: null(${a100}) == 1x(${s1})`, a100 === s1);
check(`Speed: 1.5x(${s15}) > 1x(${s1})`, s15 > s1);
check(`Speed: 2x(${s2}) > 1.5x(${s15})`, s2 > s15);
check(`Speed: 3x(${s3}) > 2x(${s2})`, s3 > s2);
check(`Speed: 5x(${s5}) == 3x(${s3}) capped at 1.5x`, s5 === s3);
check(`Speed: 2x is 1.25x base (${a100} → ${s2})`, s2 === Math.round(a100 * 1.25));
check("speedMultiplier(null) = 1", speedMultiplier(null) === 1);
check("speedMultiplier(1) = 1", speedMultiplier(1) === 1);
check("speedMultiplier(2) = 1.25", speedMultiplier(2) === 1.25);
check("speedMultiplier(3) = 1.5 (capped)", speedMultiplier(3) === 1.5);

// Floor
let floorOk = true;
for (const rank of RANKS) {
  for (const acc of [0, 50, 80, 89, 90, 95, 100]) {
    if (rhpGainForMap(rank.rangeMin, acc, null, rank.index) < 5) floorOk = false;
  }
}
check("Floor: every map pays >= 5 RHP", floorOk);
check("Copper easiest at 0% = 5 RHP", rhpGainForMap(RANKS[0].rangeMin, 0, null, 0) === 5);

// --- 4. rankIndexForRating ---
console.log("\n--- 4. rankIndexForRating ---");
check("rating 0.5 → Copper (0)", rankIndexForRating(0.5) === 0);
check("rating 1.49 → Copper (0)", rankIndexForRating(1.49) === 0);
check("rating 1.5 → Bronze (1)", rankIndexForRating(1.5) === 1);
check("rating 2.0 → Silver (2)", rankIndexForRating(2.0) === 2);
check("rating 5.0 → Expert (8)", rankIndexForRating(5.0) === 8);
check("rating 9.99 → Expert (8)", rankIndexForRating(9.99) === 8);
check("rating 12 → Expert (8, clamped)", rankIndexForRating(12) === 8);

// --- 5. maxRhpForRank ---
console.log("\n--- 5. maxRhpForRank ---");
check("Copper = 20", maxRhpForRank(0) === 20);
check("Bronze = 19", maxRhpForRank(1) === 19);
check("Silver = 18", maxRhpForRank(2) === 18);
check("Master = 13", maxRhpForRank(7) === 13);
check("Expert = 10", maxRhpForRank(8) === 10);

// --- 6. difficultyFactorForRating ---
console.log("\n--- 6. difficultyFactorForRating ---");
check("Copper easiest = 0.6", difficultyFactorForRating(0.0, 0) === 0.6);
check("Copper hardest = 1.4", Math.abs(difficultyFactorForRating(1.49, 0) - 1.4) < 0.001);
check("Copper mid = 1.0", Math.abs(difficultyFactorForRating(0.745, 0) - 1.0) < 0.01);

console.log("\n==============================================");
console.log(failures === 0 ? "  ALL TESTS PASSED ✅" : `  ${failures} TEST(S) FAILED ❌`);
console.log("==============================================");
process.exit(failures === 0 ? 0 : 1);
