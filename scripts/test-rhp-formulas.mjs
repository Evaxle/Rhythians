import { RANKS, baseRhpForRating, getRankInfo, rankIndexForRating, rhpGainForMap } from "../lib/ranks.ts";

let failures = 0;
function check(label, ok) {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
}

for (let index = 0; index < RANKS.length; index += 1) {
  const rank = RANKS[index];
  check(`${rank.name} starts at ${rank.minRhp}`, getRankInfo(rank.minRhp).index === index);
  check(`${rank.name} rating floor resolves correctly`, rankIndexForRating(rank.rangeMin) === index);
  check(`${rank.name} rating ceiling resolves correctly`, rankIndexForRating(rank.rangeMax) === index);
}

let previous = 0;
for (let rating = 0; rating <= 12; rating += 0.1) {
  const reward = baseRhpForRating(rating);
  check(`base reward monotonic at ${rating.toFixed(1)}`, reward >= previous);
  previous = reward;
}

const rating = 6.5;
check("accuracy does not reduce a valid pass", rhpGainForMap(rating, 70, 1) === rhpGainForMap(rating, 100, 1));
check("speed increases analyzed fallback reward", rhpGainForMap(rating, 100, 1.15) > rhpGainForMap(rating, 100, 1));
check("Expert starts at 20750 RHP", getRankInfo(20750).name === "Expert");

console.log(failures === 0 ? "ALL RANKING V3 FORMULA TESTS PASSED" : `${failures} TESTS FAILED`);
process.exit(failures === 0 ? 0 : 1);
