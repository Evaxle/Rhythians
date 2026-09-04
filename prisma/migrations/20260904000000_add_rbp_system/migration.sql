CREATE TABLE "RbpSeason" (
  "id" TEXT PRIMARY KEY,
  "seasonNumber" INTEGER NOT NULL UNIQUE,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "finalizedAt" TIMESTAMP(3)
);
CREATE INDEX "RbpSeason_endsAt_idx" ON "RbpSeason"("endsAt");
CREATE TABLE "RbpUserSeason" (
  "id" TEXT PRIMARY KEY,
  "seasonId" TEXT NOT NULL REFERENCES "RbpSeason"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "placementRankIndex" INTEGER NOT NULL,
  "rbp" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("seasonId","userId")
);
CREATE INDEX "RbpUserSeason_userId_idx" ON "RbpUserSeason"("userId");
CREATE INDEX "RbpUserSeason_seasonId_rbp_idx" ON "RbpUserSeason"("seasonId","rbp");
CREATE TABLE "RbpMatchResult" (
  "id" TEXT PRIMARY KEY,
  "seasonId" TEXT NOT NULL REFERENCES "RbpSeason"("id") ON DELETE CASCADE,
  "matchId" TEXT NOT NULL REFERENCES "BattleMatch"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "opponentUserId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "result" TEXT NOT NULL,
  "delta" INTEGER NOT NULL,
  "accuracy" DOUBLE PRECISION,
  "opponentAccuracy" DOUBLE PRECISION,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("seasonId","matchId","userId")
);
CREATE INDEX "RbpMatchResult_userId_createdAt_idx" ON "RbpMatchResult"("userId","createdAt");
CREATE INDEX "RbpMatchResult_matchId_idx" ON "RbpMatchResult"("matchId");
