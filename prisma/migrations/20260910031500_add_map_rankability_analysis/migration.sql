ALTER TABLE "MapDifficultyAnalysis"
  ADD COLUMN IF NOT EXISTS "rankabilityVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "rankabilityScore" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "rankabilityColor" TEXT,
  ADD COLUMN IF NOT EXISTS "rankabilityLabel" TEXT,
  ADD COLUMN IF NOT EXISTS "rankabilitySummary" TEXT,
  ADD COLUMN IF NOT EXISTS "rankabilityMetrics" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "rankabilityIssues" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "patternProfile" JSONB;

CREATE INDEX IF NOT EXISTS "MapDifficultyAnalysis_rankability_idx"
  ON "MapDifficultyAnalysis"("rankabilityScore");
