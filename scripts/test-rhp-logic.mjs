import { RANKS, getRankInfo, rankIndexForRating } from "../lib/ranks.ts";

let failures = 0;
function check(label, ok) {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
}

const boundaries = [
  [0, 0], [1.49, 0], [1.5, 1], [2.49, 1], [2.5, 2], [3.49, 2], [3.5, 3],
  [4.49, 3], [4.5, 4], [5.49, 4], [5.5, 5], [6.49, 5], [6.5, 6], [7.49, 6],
  [7.5, 7], [8.49, 7], [8.5, 8], [12, 8],
];
for (const [rating, index] of boundaries) check(`rating ${rating} -> ${RANKS[index].name}`, rankIndexForRating(rating) === index);

for (let index = 0; index < RANKS.length - 1; index += 1) {
  const current = RANKS[index];
  const next = RANKS[index + 1];
  check(`${current.name} ends before ${next.name}`, current.minRhp < next.minRhp);
  check(`${next.name} threshold changes rank`, getRankInfo(next.minRhp).index === index + 1);
  check(`${current.name} retains point below next threshold`, getRankInfo(next.minRhp - 1).index === index);
}

check("hard maps are not blocked by current player rank", rankIndexForRating(9.25) === 8 && getRankInfo(0).index === 0);

console.log(failures === 0 ? "ALL RANKING V3 LOGIC TESTS PASSED" : `${failures} TESTS FAILED`);
process.exit(failures === 0 ? 0 : 1);
