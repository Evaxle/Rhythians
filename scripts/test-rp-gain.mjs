// Temporary test — simulates the RP gain re-weight math (the DB parts of
// checkRhythiaRpGains are mocked; the formula is the real rhpFromRhythiaRp).
// Run with: node scripts/__test_rp_gain.mjs
import { rhpFromRhythiaRp } from "../lib/ranks.ts";

let failures = 0;
function check(label, ok) {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
}

// Simulates the core of checkRhythiaRpGains: target - credited, only gains pay.
function simulateGain(currentRp, credited) {
  const target = rhpFromRhythiaRp(currentRp);
  return { target, awarded: Math.max(0, target - credited) };
}

console.log("==============================================");
console.log("  RP GAIN RE-WEIGHT SIMULATION");
console.log("==============================================");

// Scenario: connect at 10,000 RP → credited 3000. Then RP grows to 11,000.
const connect = simulateGain(10000, 0);
check("Connect at 10,000 RP → 3000 RHP credited", connect.target === 3000);
const gain1 = simulateGain(11000, connect.target);
check("Grow to 11,000 RP → target 3300, award 300", gain1.target === 3300 && gain1.awarded === 300);

// Scenario: RP grows again to 12,000.
const gain2 = simulateGain(12000, connect.target + gain1.awarded);
check("Grow to 12,000 RP → target 3600, award 300", gain2.target === 3600 && gain2.awarded === 300);

// Scenario: RP drops — never claw back.
const drop = simulateGain(8000, connect.target + gain1.awarded + gain2.awarded);
check("RP drops to 8,000 → no clawback (award 0)", drop.awarded === 0);

// Scenario: RP unchanged — no award.
const same = simulateGain(12000, connect.target + gain1.awarded + gain2.awarded);
check("RP unchanged → no award", same.awarded === 0);

// Scenario: small gain at high RP (floor 0.3 applies).
const high = simulateGain(20000, 0);
check("20,000 RP → 6000 RHP", high.target === 6000);
const highGain = simulateGain(21000, high.target);
check("Grow 20,000 → 21,000 RP → target 6300, award 300", highGain.target === 6300 && highGain.awarded === 300);

console.log("\n==============================================");
console.log(failures === 0 ? "  ALL RP GAIN TESTS PASSED ✅" : `  ${failures} TEST(S) FAILED ❌`);
console.log("==============================================");
process.exit(failures === 0 ? 0 : 1);
