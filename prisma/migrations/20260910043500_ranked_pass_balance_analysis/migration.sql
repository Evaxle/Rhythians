CREATE TABLE IF NOT EXISTS "RhythiaPassAnalysis" (
  "userId" TEXT NOT NULL,
  "scoreId" INTEGER NOT NULL,
  "cameraMode" TEXT NOT NULL,
  "mapKey" TEXT NOT NULL,
  "mapTitle" TEXT NOT NULL,
  "mapperName" TEXT,
  "basePoints" INTEGER NOT NULL DEFAULT 0,
  "balanceMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "balanceScore" DOUBLE PRECISION,
  "adjustedPoints" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "mapVerified" BOOLEAN NOT NULL DEFAULT FALSE,
  "confidence" DOUBLE PRECISION,
  "replayUrl" TEXT,
  "analysis" JSONB,
  "error" TEXT,
  "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RhythiaPassAnalysis_pkey" PRIMARY KEY ("userId", "scoreId", "cameraMode"),
  CONSTRAINT "RhythiaPassAnalysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "RhythiaPassAnalysis_user_map_mode_idx" ON "RhythiaPassAnalysis"("userId", "mapKey", "cameraMode");
CREATE INDEX IF NOT EXISTS "RhythiaPassAnalysis_status_checked_idx" ON "RhythiaPassAnalysis"("status", "checkedAt");
ALTER TABLE "RhythiaPassAnalysis" ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION "preserve_rhythia_pass_balance"()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  cached RECORD;
  original_points INTEGER;
BEGIN
  SELECT "balanceMultiplier", "adjustedPoints"
    INTO cached
    FROM "RhythiaPassAnalysis"
   WHERE "userId" = NEW."userId"
     AND "scoreId" = NEW."scoreId"
     AND "cameraMode" = NEW."cameraMode"::text
     AND "status" = 'analyzed'
   LIMIT 1;

  IF FOUND AND NEW.points IS DISTINCT FROM cached."adjustedPoints" THEN
    original_points := GREATEST(0, NEW.points);
    NEW.points := GREATEST(0, ROUND(original_points * cached."balanceMultiplier")::INTEGER);
    UPDATE "RhythiaPassAnalysis"
       SET "basePoints" = original_points,
           "adjustedPoints" = NEW.points,
           "updatedAt" = CURRENT_TIMESTAMP
     WHERE "userId" = NEW."userId"
       AND "scoreId" = NEW."scoreId"
       AND "cameraMode" = NEW."cameraMode"::text;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "RhythiaModeScore_pass_balance" ON "RhythiaModeScore";
CREATE TRIGGER "RhythiaModeScore_pass_balance"
BEFORE INSERT OR UPDATE OF points, "scoreId", "cameraMode" ON "RhythiaModeScore"
FOR EACH ROW EXECUTE FUNCTION "preserve_rhythia_pass_balance"();
