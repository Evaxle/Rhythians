import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const connectionString = normalizeDatabaseUrl(
  process.env.DATABASE_POOLER_URL ?? process.env.DATABASE_URL
);

if (!connectionString) {
  throw new Error(
    "DATABASE_POOLER_URL or DATABASE_URL is not configured. Add a Supabase pooler connection string to Vercel and redeploy."
  );
}

if (connectionString.includes("localhost") || connectionString.includes("127.0.0.1")) {
  console.warn(
    "⚠️ DATABASE_URL points to a localhost/placeholder database. This will NOT work in production. Set the real Supabase connection string in Vercel."
  );
}

const adapter = new PrismaPg({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 1,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 15_000,
});

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

globalForPrisma.prisma = prisma;

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
      const url = new URL(raw);
      if (url.hostname.endsWith(".pooler.supabase.com") && url.port === "5432") {
        url.port = "6543";
        if (!url.searchParams.has("pgbouncer")) url.searchParams.set("pgbouncer", "true");
        return url.toString();
      }
      return raw;
    }
  } catch {}

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
  let host = suffixIndex === -1 ? hostAndSuffix : hostAndSuffix.slice(0, suffixIndex);
  let suffix = suffixIndex === -1 ? "" : hostAndSuffix.slice(suffixIndex);

  try {
    const hostUrl = new URL(`postgresql://${host}${suffix}`);
    if (hostUrl.hostname.endsWith(".pooler.supabase.com") && hostUrl.port === "5432") {
      hostUrl.port = "6543";
      if (!hostUrl.searchParams.has("pgbouncer")) hostUrl.searchParams.set("pgbouncer", "true");
      host = hostUrl.host;
      suffix = hostUrl.search;
    }
  } catch {}

  const repaired = `${raw.slice(0, authorityStart)}${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}${suffix}`;

  try {
    new URL(repaired);
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
