ALTER TABLE "SeasonalPathSeason" ADD COLUMN IF NOT EXISTS "finalizedAt" TIMESTAMP(3);
UPDATE "SeasonalPathSeason" SET "endsAt" = "startsAt" + INTERVAL '3 months' WHERE "finalizedAt" IS NULL AND "endsAt" <> "startsAt" + INTERVAL '3 months';
