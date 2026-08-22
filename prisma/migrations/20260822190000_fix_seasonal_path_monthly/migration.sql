ALTER TABLE "SeasonalPathSeason" ADD COLUMN IF NOT EXISTS "finalizedAt" TIMESTAMP(3);
UPDATE "SeasonalPathSeason" SET "endsAt" = "startsAt" + INTERVAL '1 month' WHERE "finalizedAt" IS NULL AND "endsAt" > "startsAt" + INTERVAL '1 month';
