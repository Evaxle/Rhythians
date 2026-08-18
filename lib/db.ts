import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const connectionString = normalizeDatabaseUrl(process.env.DATABASE_URL);

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

/**
 * Vercel environment variables are sometimes pasted with an unescaped `@`
 * in the database password. That makes the connection string invalid because
 * `@` separates credentials from the host. Encode the user-info portion while
 * preserving an already valid URL and its query parameters.
 */
function normalizeDatabaseUrl(value: string | undefined): string | undefined {
  if (!value) return value;

  const raw = value.trim().replace(/^['"]|['"]$/g, "");
  const schemeEnd = raw.indexOf("://");
  const authorityStart = schemeEnd + 3;
  const suffixIndex = raw.slice(authorityStart).search(/[/?#]/);
  const authorityEnd = suffixIndex === -1 ? -1 : authorityStart + suffixIndex;
  const authority = raw.slice(authorityStart, authorityEnd === -1 ? raw.length : authorityEnd);
  const hasUnescapedAtInPassword = authority.indexOf("@") !== authority.lastIndexOf("@");

  try {
    if (!hasUnescapedAtInPassword) {
      new URL(raw);
      return raw;
    }
  } catch {
    // Continue below so malformed credentials receive the clearer error.
  }

  const lastAt = authority.lastIndexOf("@");
  const separator = authority.indexOf(":");

  if (schemeEnd === -1 || lastAt === -1 || separator === -1 || separator > lastAt) {
    throw new Error("DATABASE_URL is not a valid PostgreSQL connection URL.");
  }

  const username = authority.slice(0, separator);
  const password = authority.slice(separator + 1, lastAt);
  const host = authority.slice(lastAt + 1);
  const suffix = authorityEnd === -1 ? "" : raw.slice(authorityEnd);
  const repaired = `${raw.slice(0, authorityStart)}${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}${suffix}`;

  try {
    new URL(repaired);
    console.warn("DATABASE_URL contained unescaped credentials; repaired its user-info encoding.");
    return repaired;
  } catch {
    throw new Error("DATABASE_URL is not a valid PostgreSQL connection URL.");
  }
}