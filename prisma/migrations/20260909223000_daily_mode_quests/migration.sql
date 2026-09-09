CREATE TABLE IF NOT EXISTS "DailyModeQuest" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "date" TIMESTAMP(3) NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "mode" TEXT NOT NULL CHECK ("mode" IN ('lock','spin','vr')),
  "mapId" TEXT NOT NULL REFERENCES "ChallengeMap"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("date","userId","mode")
);

CREATE TABLE IF NOT EXISTS "DailyModeQuestClaim" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "date" TIMESTAMP(3) NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "questId" UUID NOT NULL REFERENCES "DailyModeQuest"("id") ON DELETE CASCADE,
  "mode" TEXT NOT NULL CHECK ("mode" IN ('lock','spin','vr')),
  "mapId" TEXT NOT NULL REFERENCES "ChallengeMap"("id") ON DELETE CASCADE,
  "scoreId" INTEGER NOT NULL,
  "basePoints" INTEGER NOT NULL,
  "bonusPoints" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("date","userId")
);

CREATE INDEX IF NOT EXISTS "DailyModeQuest_user_date_idx" ON "DailyModeQuest"("userId","date");
CREATE INDEX IF NOT EXISTS "DailyModeQuestClaim_user_idx" ON "DailyModeQuestClaim"("userId");
