CREATE TABLE "ChallengeMapLevel" (
    "id" TEXT NOT NULL,
    "challengeMapId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChallengeMapLevel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChallengeMapLevel_challengeMapId_key" ON "ChallengeMapLevel"("challengeMapId");
CREATE UNIQUE INDEX "ChallengeMapLevel_level_challengeMapId_key" ON "ChallengeMapLevel"("level", "challengeMapId");
CREATE INDEX "ChallengeMapLevel_level_idx" ON "ChallengeMapLevel"("level");

ALTER TABLE "ChallengeMapLevel" ADD CONSTRAINT "ChallengeMapLevel_challengeMapId_fkey" FOREIGN KEY ("challengeMapId") REFERENCES "ChallengeMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
