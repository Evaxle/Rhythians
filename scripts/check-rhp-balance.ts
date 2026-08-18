import "dotenv/config";
import { RANKS, getRankInfo, rhpFromRhythiaRp, rhpGainForMap } from "../lib/ranks";

function rankLabel(rhp: number): string {
  const info = getRankInfo(rhp);
  return info.isExpert ? "Expert" : `${info.name} ${info.tier}`;
}

// The previous piecewise formula (F6), kept here so the current weight-based
// formula (F2, floor 0.3) can be compared against it.
function oldRhpFromRhythiaRp(rp: number): number {
  const anchors: Array<[number, number]> = [
    [0, 0], [500, 375], [1000, 700], [2000, 1200], [5000, 2500], [10000, 3500], [20000, 5000],
  ];
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

let failures = 0;
function check(label: string, ok: boolean) {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
}

function main() {
  console.log("==============================================");
  console.log("  RHYTHIANS RHP BALANCE VERIFICATION");
  console.log("==============================================");

  // 1. RP -> RHP -> rank mapping across the full skill range, new vs old.
  console.log("\n--- 1. RP → RHP → RANK MAPPING (new vs old) ---");
  const rpValues = [0, 100, 250, 500, 750, 1000, 1250, 1500, 1750, 2000, 2250, 2500, 3000, 3500, 4000, 4500, 5000, 6000, 7000, 7500, 8000, 9000, 10000, 12500, 15000, 20000, 30000];
  for (const rp of rpValues) {
    const rhp = rhpFromRhythiaRp(rp);
    const old = oldRhpFromRhythiaRp(rp);
    console.log(`  ${String(rp).padStart(6)} RP → ${String(rhp).padStart(5)} RHP (${rankLabel(rhp).padEnd(12)})  old: ${String(old).padStart(5)} RHP (${rankLabel(old)})`);
  }

  // 2. The user's specified examples must hold exactly.
  console.log("\n--- 2. SPECIFIED EXAMPLES ---");
  check("500 RP → 375 RHP (500 × 0.75)", rhpFromRhythiaRp(500) === 375);
  check("2000 RP → 1200 RHP (2000 × 0.6)", rhpFromRhythiaRp(2000) === 1200);

  // 3. Effective weight stays within [0.3, 0.8] and never exceeds 0.8.
  console.log("\n--- 3. WEIGHT BOUNDS ---");
  let weightOk = true;
  for (let rp = 0; rp <= 50000; rp += 100) {
    const rhp = rhpFromRhythiaRp(rp);
    const weight = rp > 0 ? rhp / rp : 0.75;
    if (weight > 0.8 + 1e-9 || weight < 0.3 - 1e-9) weightOk = false;
  }
  check("Effective weight stays within [0.3, 0.8] for all RP", weightOk);

  // 4. Monotonic: more RP never gives less RHP (dense grid).
  console.log("\n--- 4. MONOTONIC (every 10 RP, 0-50000) ---");
  let monoOk = true;
  let prev = -1;
  for (let rp = 0; rp <= 50000; rp += 10) {
    const v = rhpFromRhythiaRp(rp);
    if (v < prev) monoOk = false;
    prev = v;
  }
  check("Monotonic over 0-50000", monoOk);

  // 5. Low-skill players are never over-boosted into high ranks.
  console.log("\n--- 5. NO OVER-BOOSTING (low skill) ---");
  const lowChecks: Array<[number, string, string]> = [
    [100, "Novice (very low)", "Copper"],
    [500, "Novice (low)", "Copper"],
    [1000, "Novice (mid)", "Bronze"],
    [1500, "Novice (high)", "Bronze"],
  ];
  for (const [rp, title, expectedRank] of lowChecks) {
    const rhp = rhpFromRhythiaRp(rp);
    const info = getRankInfo(rhp);
    check(`${title.padEnd(20)} ${String(rp).padStart(6)} RP → ${String(rhp).padStart(5)} RHP → ${info.name} (expected ${expectedRank})`, info.name === expectedRank);
  }

  // 6. High-skill players are placed in matching ranks (not bottom, not absurd).
  console.log("\n--- 6. HIGH SKILL PLACEMENT ---");
  const highChecks: Array<[number, string, string]> = [
    [2500, "Candidate Master", "Silver"],
    [5000, "Master", "Gold"],
    [10000, "Candidate Grandmaster", "Diamond"],
    [20000, "Top player", "Expert"],
  ];
  for (const [rp, title, expectedRank] of highChecks) {
    const rhp = rhpFromRhythiaRp(rp);
    const info = getRankInfo(rhp);
    check(`${title.padEnd(20)} ${String(rp).padStart(6)} RP → ${String(rhp).padStart(5)} RHP → ${info.name} (expected ${expectedRank})`, info.name === expectedRank);
  }

  // 7. High skill is never left in the bottom three ranks.
  console.log("\n--- 7. HIGH SKILL NOT IN BOTTOM RANKS ---");
  for (const rp of [5000, 10000, 20000]) {
    const rhp = rhpFromRhythiaRp(rp);
    const info = getRankInfo(rhp);
    check(`${String(rp).padStart(6)} RP → ${info.name} (index ${info.index}) is not Copper/Bronze/Silver`, info.index >= 3);
  }

  // 8. Per-map RHP earning table (100% accuracy, no speed modifier).
  console.log("\n--- 8. RHP PER MAP (100% accuracy, no speed) ---");
  console.log("  Rank      | easiest | mid | hardest");
  for (const rank of RANKS) {
    const mid = (rank.rangeMin + rank.rangeMax) / 2;
    const easy = rhpGainForMap(rank.rangeMin, 100, null, rank.index);
    const midPts = rhpGainForMap(mid, 100, null, rank.index);
    const hard = rhpGainForMap(rank.rangeMax, 100, null, rank.index);
    console.log(`  ${rank.name.padEnd(10)} | ${String(easy).padStart(7)} | ${String(midPts).padStart(3)} | ${hard}`);
  }

  // 9. Within a rank, harder maps must pay more than easier maps.
  console.log("\n--- 9. DIFFICULTY SCALING WITHIN RANK ---");
  for (const rank of RANKS) {
    const easy = rhpGainForMap(rank.rangeMin, 100, null, rank.index);
    const hard = rhpGainForMap(rank.rangeMax, 100, null, rank.index);
    check(`${rank.name}: hardest (${hard} RHP) > easiest (${easy} RHP)`, hard > easy);
  }

  // 10. Diminishing returns: a mid-range map pays less in each higher rank.
  console.log("\n--- 10. DIMINISHING RETURNS ACROSS RANKS ---");
  let diminishing = true;
  for (let i = 1; i < RANKS.length; i++) {
    const prevMid = (RANKS[i - 1].rangeMin + RANKS[i - 1].rangeMax) / 2;
    const curMid = (RANKS[i].rangeMin + RANKS[i].rangeMax) / 2;
    const prevPts = rhpGainForMap(prevMid, 100, null, RANKS[i - 1].index);
    const curPts = rhpGainForMap(curMid, 100, null, RANKS[i].index);
    if (curPts >= prevPts) diminishing = false;
    check(`${RANKS[i - 1].name} mid (${prevMid.toFixed(2)}) = ${prevPts} RHP → ${RANKS[i].name} mid (${curMid.toFixed(2)}) = ${curPts} RHP`, curPts < prevPts);
  }
  check("Overall: higher ranks earn less per map", diminishing);

  // 11. Accuracy scaling sanity.
  console.log("\n--- 11. ACCURACY SCALING (Copper mid-range map) ---");
  const copperMid = (RANKS[0].rangeMin + RANKS[0].rangeMax) / 2;
  const acc100 = rhpGainForMap(copperMid, 100, null, 0);
  const acc95 = rhpGainForMap(copperMid, 95, null, 0);
  const acc90 = rhpGainForMap(copperMid, 90, null, 0);
  const acc80 = rhpGainForMap(copperMid, 80, null, 0);
  check(`100% (${acc100}) > 95% (${acc95}) > 90% (${acc90}) > 80% (${acc80})`, acc100 > acc95 && acc95 > acc90 && acc90 > acc80);

  // 12. Speed modifier scaling. A 2.00x run is worth 1.25x the base, capped at
  //     1.5x for extreme speeds. No modifier (null / 1.00x) is worth 1x.
  console.log("\n--- 12. SPEED MODIFIER SCALING (Copper mid-range map) ---");
  const base100 = rhpGainForMap(copperMid, 100, null, 0);
  const speed1 = rhpGainForMap(copperMid, 100, 1, 0);
  const speed15 = rhpGainForMap(copperMid, 100, 1.5, 0);
  const speed2 = rhpGainForMap(copperMid, 100, 2, 0);
  const speed3 = rhpGainForMap(copperMid, 100, 3, 0);
  const speed5 = rhpGainForMap(copperMid, 100, 5, 0);
  check(`null (${base100}) == 1.00x (${speed1})`, base100 === speed1);
  check(`1.50x (${speed15}) > 1.00x (${speed1})`, speed15 > speed1);
  check(`2.00x (${speed2}) > 1.50x (${speed15})`, speed2 > speed15);
  check(`3.00x (${speed3}) > 2.00x (${speed2})`, speed3 > speed2);
  check(`5.00x (${speed5}) == 3.00x (${speed3}) — capped at 1.5x`, speed5 === speed3);
  check(`2.00x is 1.25x base (${base100} → ${speed2})`, speed2 === Math.round(base100 * 1.25));

  // 13. Combined difficulty × accuracy × speed. A harder map at the same
  //     accuracy/speed must pay more; a better accuracy at the same
  //     difficulty/speed must pay more; a speed modifier at the same
  //     difficulty/accuracy must pay more.
  console.log("\n--- 13. COMBINED DIFFICULTY × ACCURACY × SPEED ---");
  const copperEasy = RANKS[0].rangeMin;
  const copperHard = RANKS[0].rangeMax;
  const easyAcc95 = rhpGainForMap(copperEasy, 95, null, 0);
  const hardAcc95 = rhpGainForMap(copperHard, 95, null, 0);
  check(`harder map pays more at same accuracy (${easyAcc95} → ${hardAcc95})`, hardAcc95 > easyAcc95);
  const hardAcc100 = rhpGainForMap(copperHard, 100, null, 0);
  check(`better accuracy pays more at same difficulty (${hardAcc95} → ${hardAcc100})`, hardAcc100 > hardAcc95);
  const hardAcc100Speed2 = rhpGainForMap(copperHard, 100, 2, 0);
  check(`speed modifier pays more at same difficulty+accuracy (${hardAcc100} → ${hardAcc100Speed2})`, hardAcc100Speed2 > hardAcc100);

  // 14. Floor: no map ever pays less than 5 RHP, even at terrible accuracy on
  //     the easiest map in the rank.
  console.log("\n--- 14. FLOOR (min 5 RHP) ---");
  let floorOk = true;
  for (const rank of RANKS) {
    for (const acc of [0, 50, 80, 89, 90, 95, 100]) {
      const v = rhpGainForMap(rank.rangeMin, acc, null, rank.index);
      if (v < 5) floorOk = false;
    }
  }
  check("Every rank's easiest map at any accuracy pays >= 5 RHP", floorOk);
  check("Copper easiest map at 0% accuracy pays exactly 5", rhpGainForMap(RANKS[0].rangeMin, 0, null, 0) === 5);

  // 15. Full verification table for a few representative maps.
  console.log("\n--- 15. REPRESENTATIVE MAP TABLE ---");
  console.log("  Map (rank)      | 100% | 95% | 90% | 100%+2x | 95%+2x");
  const reps: Array<[string, number, number]> = [
    ["Copper easy (0.00)", RANKS[0].rangeMin, 0],
    ["Copper mid (0.75)", copperMid, 0],
    ["Copper hard (1.49)", RANKS[0].rangeMax, 0],
    ["Silver mid (2.25)", (RANKS[2].rangeMin + RANKS[2].rangeMax) / 2, 2],
    ["Master mid (4.75)", (RANKS[7].rangeMin + RANKS[7].rangeMax) / 2, 7],
    ["Expert mid (7.50)", (RANKS[8].rangeMin + RANKS[8].rangeMax) / 2, 8],
  ];
  for (const [label, rating, rankIdx] of reps) {
    const a100 = rhpGainForMap(rating, 100, null, rankIdx);
    const a95 = rhpGainForMap(rating, 95, null, rankIdx);
    const a90 = rhpGainForMap(rating, 90, null, rankIdx);
    const a100s2 = rhpGainForMap(rating, 100, 2, rankIdx);
    const a95s2 = rhpGainForMap(rating, 95, 2, rankIdx);
    console.log(`  ${label.padEnd(20)} | ${String(a100).padStart(4)} | ${String(a95).padStart(4)} | ${String(a90).padStart(4)} | ${String(a100s2).padStart(7)} | ${String(a95s2).padStart(6)}`);
  }

  console.log("\n==============================================");
  console.log(failures === 0 ? "  ALL CHECKS PASSED ✅" : `  ${failures} CHECK(S) FAILED ❌`);
  console.log("==============================================");
  process.exit(failures === 0 ? 0 : 1);
}

main();
