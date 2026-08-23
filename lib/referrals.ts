import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";

export const REFERRAL_COOKIE_NAME = "rhythians_referrer";
export const REFERRAL_GOAL = 5;

let tableEnsured = false;

export async function ensureReferralTable() {
  if (tableEnsured) return;
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Referral" ("id" TEXT NOT NULL PRIMARY KEY, "referrerId" TEXT NOT NULL, "referredUserId" TEXT NOT NULL UNIQUE, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Referral_referrerId_idx" ON "Referral"("referrerId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Referral_createdAt_idx" ON "Referral"("createdAt")`);
  tableEnsured = true;
}

export async function recordReferral(referrerId: string, referredUserId: string) {
  if (referrerId === referredUserId) return false;
  await ensureReferralTable();
  const referrer = await prisma.user.findUnique({ where: { id: referrerId }, select: { id: true } });
  if (!referrer) return false;
  const result = await prisma.$executeRawUnsafe(`INSERT INTO "Referral" ("id", "referrerId", "referredUserId") VALUES ($1, $2, $3) ON CONFLICT ("referredUserId") DO NOTHING`, randomUUID(), referrerId, referredUserId);
  return result > 0;
}

export async function getReferralProgress(userId: string) {
  await ensureReferralTable();
  await prisma.$executeRawUnsafe(`INSERT INTO "Tag" ("id", "name", "slug") VALUES ($1, 'Contributor', 'contributor') ON CONFLICT ("slug") DO NOTHING`, randomUUID());
  const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT COUNT(*)::bigint AS count FROM "Referral" WHERE "referrerId" = $1`, userId);
  const count = Number(rows[0]?.count ?? 0);
  const tags = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id" FROM "Tag" WHERE "slug" = 'contributor' LIMIT 1`);
  const contributorTagId = tags[0]?.id ?? null;
  let earned = false;
  if (contributorTagId) {
    const owned = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id" FROM "UserTag" WHERE "userId" = $1 AND "tagId" = $2 LIMIT 1`, userId, contributorTagId);
    earned = owned.length > 0;
  }
  return { count: Math.min(REFERRAL_GOAL, count), earned };
}

export async function redeemContributorTag(userId: string) {
  await ensureReferralTable();
  await prisma.$executeRawUnsafe(`INSERT INTO "Tag" ("id", "name", "slug") VALUES ($1, 'Contributor', 'contributor') ON CONFLICT ("slug") DO NOTHING`, randomUUID());
  const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT COUNT(*)::bigint AS count FROM "Referral" WHERE "referrerId" = $1`, userId);
  if (Number(rows[0]?.count ?? 0) < REFERRAL_GOAL) return { success: false, error: "You need 5 successful sign-ups from your share link first." };
  const tags = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id" FROM "Tag" WHERE "slug" = 'contributor' LIMIT 1`);
  const tagId = tags[0]?.id;
  if (!tagId) return { success: false, error: "Contributor tag is unavailable." };
  await prisma.$executeRawUnsafe(`INSERT INTO "UserTag" ("id", "userId", "tagId", "source") VALUES ($1, $2, $3, 'manual') ON CONFLICT ("userId", "tagId") DO NOTHING`, randomUUID(), userId, tagId);
  return { success: true };
}
