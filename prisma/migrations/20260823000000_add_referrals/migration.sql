CREATE TABLE IF NOT EXISTS "Referral" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "referrerId" TEXT NOT NULL,
  "referredUserId" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Referral_referrerId_idx" ON "Referral"("referrerId");
CREATE INDEX IF NOT EXISTS "Referral_createdAt_idx" ON "Referral"("createdAt");

INSERT INTO "Tag" ("id", "name", "slug")
VALUES (concat('contributor-', md5(random()::text)), 'Contributor', 'contributor')
ON CONFLICT ("slug") DO NOTHING;
