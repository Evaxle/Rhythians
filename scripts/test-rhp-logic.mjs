import { RANKS, getRankInfo, rankIndexForRating } from "../lib/ranks.ts";

let failures = 0;
function check(label, ok) {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
}

const boundaries = [
  [0, 0], [2.49, 0], [2.5, 1], [3.19, 1], [3.2, 2], [3.69, 2],
  [3.7, 3], [4.19, 3], [4.2, 4], [4.69, 4], [4.7, 5], [5.19, 5],
  [5.2, 6], [5.69, 6], [5.7, 7], [6.19, 7], [6.2, 8], [12, 8],
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
