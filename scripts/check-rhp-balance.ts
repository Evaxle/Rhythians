import "dotenv/config";
import { RANKS, baseRhpForRating, getRankInfo } from "../lib/ranks";
import { MODE_RULES } from "../lib/rhythia-mode-rules";
import { modeRankInfo } from "../lib/mode-ranks";

let failures = 0;
function check(label: string, ok: boolean) {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
}

function main() {
  console.log("RHYTHIANS RANKING V3 BALANCE CHECK");
  let previous = -1;
  for (const rank of RANKS) {
    check(`${rank.name} threshold increases`, rank.minRhp > previous);
    previous = rank.minRhp;
    const midpoint = rank.index === RANKS.length - 1 ? rank.rangeMin + 0.5 : (rank.rangeMin + rank.rangeMax) / 2;
    console.log(`${rank.name.padEnd(9)} ${String(rank.minRhp).padStart(6)} RHP · ${midpoint.toFixed(2)} map ≈ ${Math.round(baseRhpForRating(midpoint))} base`);
  }

  for (const mode of ["lock", "vr", "spin"] as const) {
    const rules = MODE_RULES[mode];
    console.log(`\n${rules.short} rank scale ${rules.rankScale.toFixed(2)} · reward ${rules.rewardMultiplier.toFixed(2)}x`);
    for (const rank of RANKS) {
      const threshold = Math.round(rank.minRhp * rules.rankScale);
      const info = modeRankInfo(threshold, mode);
      check(`${rules.short} ${rank.name} starts at ${threshold}`, info.index === rank.index);
    }
  }

  for (let rhp = 0; rhp <= 30000; rhp += 250) {
    const info = getRankInfo(rhp);
    check(`RHP ${rhp} resolves to valid rank`, info.index >= 0 && info.index < RANKS.length);
  }

  if (failures) {
    console.error(`${failures} checks failed.`);
    process.exit(1);
  }
  console.log("All ranking v3 balance checks passed.");
}

main();
