ALTER TABLE "StreamerAccount"
  ADD COLUMN IF NOT EXISTS "providerAccountId" TEXT,
  ADD COLUMN IF NOT EXISTS "accessToken" TEXT,
  ADD COLUMN IF NOT EXISTS "refreshToken" TEXT,
  ADD COLUMN IF NOT EXISTS "tokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "refreshExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS scopes TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "StreamerAccount_platform_providerAccountId_key"
  ON "StreamerAccount" (platform, "providerAccountId")
  WHERE "providerAccountId" IS NOT NULL;

ALTER TABLE "StreamerAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StreamerProfilePost" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "StreamerAccount" FROM anon, authenticated;
REVOKE ALL ON TABLE "StreamerProfilePost" FROM anon, authenticated;
