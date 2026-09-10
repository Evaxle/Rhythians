let failures = 0;
function check(label, ok) {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
}
function overallRhp({ rpl, rpv, rps }) {
  return rpl + rpv + rps;
}

check("lock-only RHP equals RPL", overallRhp({ rpl: 100, rpv: 0, rps: 0 }) === 100);
check("VR-only RHP equals RPV", overallRhp({ rpl: 0, rpv: 106, rps: 0 }) === 106);
check("spin-only RHP equals RPS", overallRhp({ rpl: 0, rpv: 0, rps: 112 }) === 112);
check("all camera-mode totals add exactly", overallRhp({ rpl: 100, rpv: 106, rps: 112 }) === 318);
check("no same-map diminishing weights remain", overallRhp({ rpl: 100, rpv: 100, rps: 100 }) === 300);
check("zero passes means zero RHP", overallRhp({ rpl: 0, rpv: 0, rps: 0 }) === 0);

console.log(failures === 0 ? "ALL PASS-ONLY RANKING TESTS PASSED" : `${failures} TESTS FAILED`);
process.exit(failures === 0 ? 0 : 1);
