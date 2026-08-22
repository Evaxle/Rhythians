CREATE TABLE IF NOT EXISTS "UserProfileTag" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserProfileTag_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserProfileTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserProfileTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserProfileTag_userId_tagId_key" UNIQUE ("userId", "tagId"),
  CONSTRAINT "UserProfileTag_userId_position_key" UNIQUE ("userId", "position")
);

CREATE INDEX IF NOT EXISTS "UserProfileTag_userId_idx" ON "UserProfileTag"("userId");

CREATE TABLE IF NOT EXISTS "SeasonalPathSeason" (
  "id" TEXT NOT NULL,
  "seasonNumber" INTEGER NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeasonalPathSeason_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SeasonalPathSeason_seasonNumber_key" UNIQUE ("seasonNumber")
);

CREATE TABLE IF NOT EXISTS "SeasonalPathMap" (
  "id" TEXT NOT NULL,
  "seasonId" TEXT NOT NULL,
  "rankIndex" INTEGER NOT NULL,
  "challengeMapId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeasonalPathMap_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SeasonalPathMap_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "SeasonalPathSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SeasonalPathMap_challengeMapId_fkey" FOREIGN KEY ("challengeMapId") REFERENCES "ChallengeMap"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SeasonalPathMap_seasonId_rankIndex_key" UNIQUE ("seasonId", "rankIndex"),
  CONSTRAINT "SeasonalPathMap_seasonId_challengeMapId_key" UNIQUE ("seasonId", "challengeMapId")
);

CREATE INDEX IF NOT EXISTS "SeasonalPathMap_seasonId_idx" ON "SeasonalPathMap"("seasonId");

CREATE TABLE IF NOT EXISTS "SeasonalPathCompletion" (
  "id" TEXT NOT NULL,
  "seasonId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "rankIndex" INTEGER NOT NULL,
  "seasonalPathMapId" TEXT NOT NULL,
  "scoreId" INTEGER,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeasonalPathCompletion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SeasonalPathCompletion_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "SeasonalPathSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SeasonalPathCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SeasonalPathCompletion_seasonalPathMapId_fkey" FOREIGN KEY ("seasonalPathMapId") REFERENCES "SeasonalPathMap"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SeasonalPathCompletion_seasonId_userId_rankIndex_key" UNIQUE ("seasonId", "userId", "rankIndex")
);

CREATE INDEX IF NOT EXISTS "SeasonalPathCompletion_userId_idx" ON "SeasonalPathCompletion"("userId");
CREATE INDEX IF NOT EXISTS "SeasonalPathCompletion_seasonId_idx" ON "SeasonalPathCompletion"("seasonId");
