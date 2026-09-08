CREATE TABLE IF NOT EXISTS "StreamerAccount" (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  username TEXT NOT NULL,
  "profileUrl" TEXT NOT NULL,
  "verificationCode" TEXT,
  "verificationExpiresAt" TIMESTAMP(3),
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  "verifiedAt" TIMESTAMP(3),
  "isLive" BOOLEAN NOT NULL DEFAULT FALSE,
  "liveCheckedAt" TIMESTAMP(3),
  "liveUrl" TEXT,
  "showProfilePosts" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("userId", platform),
  UNIQUE (platform, username)
);
CREATE INDEX IF NOT EXISTS "StreamerAccount_live_idx" ON "StreamerAccount" (verified, "isLive", "liveCheckedAt");

CREATE TABLE IF NOT EXISTS "StreamerProfilePost" (
  id TEXT PRIMARY KEY,
  "accountId" TEXT NOT NULL REFERENCES "StreamerAccount"(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("accountId", url)
);
CREATE INDEX IF NOT EXISTS "StreamerProfilePost_account_position_idx" ON "StreamerProfilePost" ("accountId", position);

ALTER TABLE "Clip" ADD COLUMN IF NOT EXISTS "externalUrl" TEXT;
ALTER TABLE "Clip" ADD COLUMN IF NOT EXISTS "externalProvider" TEXT;
ALTER TABLE "Clip" ALTER COLUMN "storagePath" DROP NOT NULL;
