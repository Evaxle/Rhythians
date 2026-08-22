import { prisma } from "@/lib/db";

export const CURRENT_TERMS_VERSION = "2026-08-22";

export async function hasAcceptedCurrentTerms(userId: string) {
  const rows = await prisma.$queryRaw<Array<{ version: string }>>`
    SELECT "version"
    FROM "TermsAcceptance"
    WHERE "userId" = ${userId}
    LIMIT 1
  `;
  return rows[0]?.version === CURRENT_TERMS_VERSION;
}
