import { Client } from "pg";
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  const { rows } = await client.query("select to_regclass('public._prisma_migrations') as table_name");
  if (!rows[0]?.table_name) {
    const migrations = readdirSync("prisma/migrations", { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    for (const migration of migrations) {
      execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", ["prisma", "migrate", "resolve", "--applied", migration], {
        stdio: "inherit",
        env: process.env,
      });
    }
  }
} finally {
  await client.end();
}

execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: process.env,
});
