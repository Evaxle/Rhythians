import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const configDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(configDir, ".env") });

const rawDatabaseUrl = process.env.DATABASE_URL;

if (!rawDatabaseUrl) {
  throw new Error("DATABASE_URL is required");
}

let databaseUrl = rawDatabaseUrl;

if (process.env.VERCEL === "1") {
  const url = new URL(rawDatabaseUrl);
  const directHost = /^db\.([a-z0-9]+)\.supabase\.co$/i.exec(url.hostname);

  if (directHost) {
    url.hostname = "aws-0-us-east-1.pooler.supabase.com";
    if (url.username === "postgres") {
      url.username = `postgres.${directHost[1]}`;
    }
    url.port = "5432";
    databaseUrl = url.toString();
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
