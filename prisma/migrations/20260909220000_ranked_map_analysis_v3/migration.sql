CREATE TABLE IF NOT EXISTS "MapDifficultyAnalysis" (
  "mapId" TEXT NOT NULL,
  "analyzerVersion" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'unanalyzed',
  "sourceStatus" TEXT NOT NULL DEFAULT 'ranked',
  "pointEligible" BOOLEAN NOT NULL DEFAULT FALSE,
  "rating" DOUBLE PRECISION,
  "directionScore" DOUBLE PRECISION,
  "distanceScore" DOUBLE PRECISION,
  "npsScore" DOUBLE PRECISION,
  "staminaIndex" DOUBLE PRECISION,
  "activeDurationMs" INTEGER,
  "longestHardSectionMs" INTEGER,
  "peakJumpNps" DOUBLE PRECISION,
  "peakStreamNps" DOUBLE PRECISION,
  "peakJumpStrain" DOUBLE PRECISION,
  "peakStreamStrain" DOUBLE PRECISION,
  "jumpRatio" DOUBLE PRECISION,
  "rpl" INTEGER,
  "rpv" INTEGER,
  "rps" INTEGER,
  "speedProfiles" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "topSections" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "error" TEXT,
  "analyzedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MapDifficultyAnalysis_pkey" PRIMARY KEY ("mapId"),
  CONSTRAINT "MapDifficultyAnalysis_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "ChallengeMap"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "MapDifficultyAnalysis_status_idx" ON "MapDifficultyAnalysis"("status");
CREATE INDEX IF NOT EXISTS "MapDifficultyAnalysis_pointEligible_idx" ON "MapDifficultyAnalysis"("pointEligible");
