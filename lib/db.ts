import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not configured. Add it to your Vercel project (Settings → Environment Variables) and redeploy. It must be the Supabase/Postgres connection string, e.g. postgresql://user:password@host:5432/postgres."
  );
}

// Warn loudly if the placeholder localhost URL is being used at runtime — it can never
// connect from Vercel (or anywhere outside the machine that runs Postgres).
if (connectionString.includes("localhost") || connectionString.includes("127.0.0.1")) {
  console.warn(
    "⚠️ DATABASE_URL points to a localhost/placeholder database. This will NOT work in production. Set the real Supabase connection string in Vercel."
  );
}

const adapter = new PrismaPg({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}