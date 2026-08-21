import { Client } from "pg";
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";

const rawDatabaseUrl = process.env.DATABASE_URL;
if (!rawDatabaseUrl) throw new Error("DATABASE_URL is required");

let databaseUrl = rawDatabaseUrl;
if (process.env.VERCEL === "1") {
  const url = new URL(rawDatabaseUrl);
  const directHost = /^db\.([a-z0-9]+)\.supabase\.co$/i.exec(url.hostname);
  if (directHost) {
    url.hostname = "aws-0-us-east-1.pooler.supabase.com";
    if (url.username === "postgres") url.username = `postgres.${directHost[1]}`;
    url.port = "5432";
    databaseUrl = url.toString();
  }
}

const client = new Client({ connectionString: databaseUrl });
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
        env: { ...process.env, DATABASE_URL: databaseUrl },
      });
    }
  }
} finally {
  await client.end();
}

execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: databaseUrl },
});
