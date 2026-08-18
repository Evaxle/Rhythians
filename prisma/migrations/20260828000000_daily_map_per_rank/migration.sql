-- Daily maps become per-rank: each rank gets its own daily map each day.

-- Add the rank column with a default for existing rows.
ALTER TABLE "DailyMap" ADD COLUMN "rankIndex" INTEGER NOT NULL DEFAULT 0;

-- Drop the old date-unique constraint and index.
DROP INDEX IF EXISTS "DailyMap_date_key";
DROP INDEX IF EXISTS "DailyMap_date_idx";

-- Recreate the date index (non-unique) and add a rank index.
CREATE INDEX "DailyMap_date_idx" ON "DailyMap"("date");
CREATE INDEX "DailyMap_rankIndex_idx" ON "DailyMap"("rankIndex");

-- Make date+rank unique.
CREATE UNIQUE INDEX "DailyMap_date_rankIndex_key" ON "DailyMap"("date", "rankIndex");