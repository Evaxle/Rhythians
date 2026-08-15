import "dotenv/config";
import { runDbCleanup } from "../lib/db-cleanup";

async function main() {
  const force = process.argv.includes("--force");
  const results = await runDbCleanup({ forceBackfill: force });
  console.log("DB cleanup complete");
  console.table(results);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
