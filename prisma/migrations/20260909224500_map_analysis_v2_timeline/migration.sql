ALTER TABLE "MapDifficultyAnalysis"
ADD COLUMN IF NOT EXISTS "patternSegments" JSONB NOT NULL DEFAULT '[]'::jsonb;
