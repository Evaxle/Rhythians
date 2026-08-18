// Temporary test harness — verifies the pure logic of the leaderboard scoping,
// leaderboard sorting, and check-all rank-range filtering, using the real
// functions from lib/ranks.ts. bestScoreByTitle is inlined (it's a pure
// function; lib/maps.ts can't be imported directly due to the @/ path alias).
// Run with: node scripts/__test_logic.mjs
import { RANKS, getRankInfo, isMapInRankRange, rankIndexForRating } from "../lib/ranks.ts";

function normalizeTitle(value) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function bestScoreByTitle(scores) {
  const best = new Map();
  for (const score of scores) {
    if (!score.passed) continue;
    const title = normalizeTitle(score.beatmapTitle);
    if (!title) continue;
    const existing = best.get(title);
    if (!existing || (score.awarded_sp ?? 0) > (existing.awarded_sp ?? 0)) best.set(title, score);
  }
  return best;
}

let failures = 0;
function check(label, ok) {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
}

console.log("==============================================");
console.log("  RHYTHIANS LOGIC TESTS (leaderboard / check-all)");
console.log("==============================================");

// --- 1. Leaderboard rank-scoping ---
// A Copper map (rating 1.0) should only show players currently in Copper (0-499 RHP).
console.log("\n--- 1. LEADERBOARD RANK-SCOPING (Copper map, rating 1.0) ---");
const mapRating = 1.0;
const rankIndex = rankIndexForRating(mapRating);
const rank = RANKS[rankIndex];
const minRhp = rank.minRhp;
const maxRhp = rankIndex < RANKS.length - 1 ? RANKS[rankIndex + 1].minRhp : null;
check(`Copper map → rankIndex ${rankIndex} (Copper)`, rankIndex === 0);

// Simulated completions with users at various RHP
const completions = [
  { user: { rhp: 100 }, accuracy: 98, points: 15 },   // Copper → should show
  { user: { rhp: 450 }, accuracy: 95, points: 12 },   // Copper → should show
  { user: { rhp: 600 }, accuracy: 99, points: 18 },   // Bronze → should NOT show (ranked up)
  { user: { rhp: 1200 }, accuracy: 100, points: 20 }, // Silver → should NOT show
  { user: { rhp: 0 }, accuracy: 90, points: 10 },     // Copper → should show
];
const scoped = completions.filter((c) => {
  const rhp = c.user.rhp;
  return maxRhp == null ? rhp >= minRhp : rhp >= minRhp && rhp < maxRhp;
});
check("Only Copper players appear (3 of 5)", scoped.length === 3);
check("Bronze player (600 RHP) excluded after ranking up", !scoped.some((c) => c.user.rhp === 600));
check("Silver player (1200 RHP) excluded", !scoped.some((c) => c.user.rhp === 1200));

// --- 2. Leaderboard sorting (accuracy desc, then points desc) ---
console.log("\n--- 2. LEADERBOARD SORTING ---");
const rows = [
  { accuracy: 95, points: 12 },
  { accuracy: 100, points: 20 },
  { accuracy: 100, points: 15 },
  { accuracy: null, points: 30 },
  { accuracy: 98, points: 18 },
].sort((a, b) => (b.accuracy ?? -1) - (a.accuracy ?? -1) || b.points - a.points);
const order = rows.map((r) => `${r.accuracy ?? "null"}/${r.points}`);
check("Sorted by accuracy desc, then points desc", JSON.stringify(order) === JSON.stringify(["100/20", "100/15", "98/18", "95/12", "null/30"]));
check("Null accuracy sorts last", rows[rows.length - 1].accuracy === null);

// --- 3. Check-all rank-range filtering ---
console.log("\n--- 3. CHECK-ALL RANK-RANGE FILTERING ---");
// A user in Silver (index 2) should only get RHP for maps rated 2.00-2.49.
const silverIndex = 2;
const maps = [
  { title: "Easy map", rating: 1.0 },    // Copper → skip
  { title: "Bronze map", rating: 1.7 },  // Bronze → skip
  { title: "Silver low", rating: 2.0 },  // Silver → check
  { title: "Silver high", rating: 2.49 },// Silver → check
  { title: "Gold map", rating: 2.5 },    // Gold → skip
  { title: "Expert map", rating: 5.5 },  // Expert → skip
];
const inRange = maps.filter((m) => isMapInRankRange(m.rating, silverIndex));
check("Silver user only checks Silver maps (2 of 6)", inRange.length === 2);
check("Silver low (2.0) included", inRange.some((m) => m.title === "Silver low"));
check("Silver high (2.49) included", inRange.some((m) => m.title === "Silver high"));
check("Gold map (2.5) excluded", !inRange.some((m) => m.title === "Gold map"));

// --- 4. bestScoreByTitle (best passing score per map) ---
console.log("\n--- 4. bestScoreByTitle ---");
const scores = [
  { id: 1, beatmapTitle: "Song - Artist", passed: true, awarded_sp: 100 },
  { id: 2, beatmapTitle: "Song - Artist", passed: true, awarded_sp: 150 },
  { id: 3, beatmapTitle: "Song - Artist", passed: false, awarded_sp: 200 },
  { id: 4, beatmapTitle: "Other Song", passed: true, awarded_sp: 50 },
  { id: 5, beatmapTitle: null, passed: true, awarded_sp: 999 },
];
const best = bestScoreByTitle(scores);
check("Best passing score per title (150 > 100)", best.get("song artist")?.id === 2);
check("Failed score ignored", best.get("song artist")?.id !== 3);
check("Other song present", best.get("other song")?.id === 4);
check("Null title skipped", best.size === 2);

// --- 5. isMapInRankRange boundaries ---
console.log("\n--- 5. RANK RANGE BOUNDARIES ---");
check("Copper: 0.0 in range", isMapInRankRange(0.0, 0));
check("Copper: 1.49 in range", isMapInRankRange(1.49, 0));
check("Copper: 1.5 NOT in range (Bronze)", !isMapInRankRange(1.5, 0));
check("Bronze: 1.5 in range", isMapInRankRange(1.5, 1));
check("Expert: 5.0 in range", isMapInRankRange(5.0, 8));
check("Expert: 9.99 in range", isMapInRankRange(9.99, 8));

console.log("\n==============================================");
console.log(failures === 0 ? "  ALL LOGIC TESTS PASSED ✅" : `  ${failures} TEST(S) FAILED ❌`);
console.log("==============================================");
process.exit(failures === 0 ? 0 : 1);
