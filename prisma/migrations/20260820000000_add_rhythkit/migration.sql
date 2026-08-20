CREATE TABLE IF NOT EXISTS "RhythKitInstallation" (
  "installationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "RhythKitInstallation_pkey" PRIMARY KEY ("installationId"),
  CONSTRAINT "RhythKitInstallation_tokenHash_key" UNIQUE ("tokenHash"),
  CONSTRAINT "RhythKitInstallation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "RhythKitInstallation_userId_idx" ON "RhythKitInstallation"("userId");

CREATE TABLE IF NOT EXISTS "RhythKitScore" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "installationId" TEXT NOT NULL,
  "challengeMapId" TEXT NOT NULL,
  "clientScoreId" TEXT NOT NULL,
  "accuracy" DOUBLE PRECISION,
  "misses" INTEGER,
  "speed" DOUBLE PRECISION,
  "points" INTEGER NOT NULL,
  "rhpAwarded" INTEGER NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RhythKitScore_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RhythKitScore_installationId_clientScoreId_key" UNIQUE ("installationId", "clientScoreId"),
  CONSTRAINT "RhythKitScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RhythKitScore_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "RhythKitInstallation"("installationId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RhythKitScore_challengeMapId_fkey" FOREIGN KEY ("challengeMapId") REFERENCES "ChallengeMap"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "RhythKitScore_userId_submittedAt_idx" ON "RhythKitScore"("userId", "submittedAt");
CREATE INDEX IF NOT EXISTS "RhythKitScore_challengeMapId_idx" ON "RhythKitScore"("challengeMapId");
