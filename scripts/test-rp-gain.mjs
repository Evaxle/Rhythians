const weights = [1, 0.55, 0.35];

let failures = 0;
function check(label, ok) {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
}
function mapRhp(values) {
  return [...values].sort((a, b) => b - a).slice(0, 3).reduce((sum, value, index) => sum + value * weights[index], 0);
}

check("single clear contributes full value", mapRhp([100]) === 100);
check("second mode clear contributes diminished value", Math.round(mapRhp([100, 106])) === 161);
check("three mode clears all contribute", Math.round(mapRhp([100, 106, 112])) === 196);
check("strongest mode is always weighted first", Math.round(mapRhp([112, 100, 106])) === 196);
check("multi-mode RHP remains below triple payout", mapRhp([100, 106, 112]) < 318);
check("quest bonus is additive outside same-map diminishing weights", Math.round(mapRhp([100, 106, 112]) + 34) === 230);

console.log(failures === 0 ? "ALL RANKING V3 MULTI-CLEAR TESTS PASSED" : `${failures} TESTS FAILED`);
process.exit(failures === 0 ? 0 : 1);
