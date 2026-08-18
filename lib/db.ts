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
  if (!raw) return raw;

  const schemeEnd = raw.indexOf("://");
  const authorityStart = schemeEnd + 3;
  const authoritySuffix = raw.slice(authorityStart).search(/[/?#]/);
  const authorityEnd = authoritySuffix === -1 ? raw.length : authorityStart + authoritySuffix;
  const authority = raw.slice(authorityStart, authorityEnd);
  const hasMultipleAtSigns = authority.indexOf("@") !== authority.lastIndexOf("@");

  try {
    if (!hasMultipleAtSigns) {
      new URL(raw);
      return raw;
    }
  } catch {
    // Repair credentials below. PostgreSQL passwords commonly contain @, ?, #,
    // or /, all of which must be percent-encoded inside a URL.
  }

  const lastAt = raw.lastIndexOf("@");
  const credentials = raw.slice(authorityStart, lastAt);
  const separator = credentials.indexOf(":");

  if (schemeEnd === -1 || lastAt <= authorityStart || separator === -1) {
    console.error("DATABASE_URL is invalid. Set it to a complete postgresql:// connection string in Vercel.");
    return "postgresql://invalid:invalid@localhost:5432/invalid";
  }

  const username = decodeUrlPart(credentials.slice(0, separator));
  const password = decodeUrlPart(credentials.slice(separator + 1));
  const hostAndSuffix = raw.slice(lastAt + 1);
  const suffixIndex = hostAndSuffix.search(/[/?#]/);
  const host = suffixIndex === -1 ? hostAndSuffix : hostAndSuffix.slice(0, suffixIndex);
  const suffix = suffixIndex === -1 ? "" : hostAndSuffix.slice(suffixIndex);
  const repaired = `${raw.slice(0, authorityStart)}${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}${suffix}`;

  try {
    new URL(repaired);
    console.warn("DATABASE_URL contained unescaped credentials; repaired its user-info encoding.");
    return repaired;
  } catch {
    console.error("DATABASE_URL is invalid. Set it to a complete postgresql:// connection string in Vercel.");
    return "postgresql://invalid:invalid@localhost:5432/invalid";
  }
}

function decodeUrlPart(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}