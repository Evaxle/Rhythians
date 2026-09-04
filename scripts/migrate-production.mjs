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

const prismaEnv = { ...process.env, DATABASE_URL: databaseUrl };
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

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
      execFileSync(npx, ["prisma", "migrate", "resolve", "--applied", migration], {
        stdio: "inherit",
        env: prismaEnv,
      });
    }
  } else {
    const { rows: failedMigrations } = await client.query(
      'SELECT DISTINCT migration_name FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL ORDER BY migration_name'
    );

    for (const { migration_name } of failedMigrations) {
      console.warn(`Recovering failed Prisma migration: ${migration_name}`);
      execFileSync(npx, ["prisma", "migrate", "resolve", "--rolled-back", migration_name], {
        stdio: "inherit",
        env: prismaEnv,
      });
    }
  }
} finally {
  await client.end();
}

execFileSync(npx, ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: prismaEnv,
});