import assert from "node:assert/strict";
import { auditTournamentPoolRows } from "./audit-tournament-map-pools.mjs";

const rows = [];
for (let i = 0; i < 100; i++) rows.push({ split: "lower", stage: "regular", mapId: `lr${i}`, rating: 1.8 });
for (let i = 0; i < 6; i++) rows.push({ split: "lower", stage: "finals", mapId: `lf${i}`, rating: 2.5 });
for (let i = 0; i < 100; i++) rows.push({ split: "higher", stage: "regular", mapId: `hr${i}`, rating: 3.2 });
for (let i = 0; i < 6; i++) rows.push({ split: "higher", stage: "finals", mapId: `hf${i}`, rating: 3.65 });
assert.equal(auditTournamentPoolRows(rows).ok, true);
rows.pop();
assert.equal(auditTournamentPoolRows(rows).ok, false);
console.log("Tournament map-pool audit passed");
