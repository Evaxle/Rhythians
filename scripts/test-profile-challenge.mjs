import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(path, dependencies = {}) {
  const source = ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    require: (id) => {
      assert.ok(id in dependencies, `Unexpected import: ${id}`);
      return dependencies[id];
    },
  });
  return exports;
}
const constants = load("lib/category-constants.ts");
const { getProfileChallenge } = load("lib/profile-challenge.ts", {
  "./category-constants": constants,
});
const levels = constants.CATEGORIES.map((category, index) => ({
  category,
  level: index + 1,
}));
for (const [index, category] of constants.CATEGORIES.entries()) {
  const result = getProfileChallenge(category, levels);
  assert.equal(result.category, category);
  assert.equal(result.level, index + 1);
}
assert.equal(
  getProfileChallenge("vibro", [
    { category: "vibro", level: 0 },
    { category: "jumps", level: 10 },
  ]).level,
  0,
);
assert.equal(getProfileChallenge("tech", []).level, 0);
assert.equal(getProfileChallenge("tech", null).level, null);
for (const category of [null, undefined, "", "removed-category"]) {
  assert.equal(getProfileChallenge(category, levels).category, null);
  assert.equal(getProfileChallenge(category, levels).level, null);
}
console.log(
  "Profile challenge checks passed: all categories, zero progress, missing levels, unavailable data, and no favorite.",
);
