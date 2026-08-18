// Temporary test — verifies the archiver zip logic used by the category
// download route works at runtime (streaming a file into a zip).
// Run with: node scripts/__test_zip.mjs
import { Readable } from "node:stream";
import { ZipArchive } from "archiver";

let failures = 0;
function check(label, ok) {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
}

console.log("==============================================");
console.log("  ARCHIVER ZIP LOGIC TEST");
console.log("==============================================");

// Simulate the download route: create a zip, append a streamed "map file",
// and collect the output bytes.
const archive = new ZipArchive({ zlib: { level: 9 } });
const chunks = [];
archive.on("data", (chunk) => chunks.push(chunk));
archive.on("end", () => {
  const total = Buffer.concat(chunks).length;
  check("Zip produced output bytes", total > 0);
  // A valid zip starts with PK\x03\x04
  const head = Buffer.concat(chunks).subarray(0, 4).toString("utf8");
  check("Zip has valid PK header", head === "PK\x03\x04" || head === "PK\x05\x06");
  console.log(`  Zip size: ${total} bytes`);
  console.log("==============================================");
  console.log(failures === 0 ? "  ZIP TEST PASSED ✅" : `  ${failures} TEST(S) FAILED ❌`);
  process.exit(failures === 0 ? 0 : 1);
});
archive.on("error", (error) => {
  console.error("  FAIL  archiver error:", error.message);
  process.exit(1);
});

// Append a streamed "map file" (simulating Readable.fromWeb of a fetched file).
const fakeMapContent = Buffer.from("fake map file content for testing");
archive.append(Readable.from([fakeMapContent]), { name: "level-1/Test Map.map" });
archive.finalize();
