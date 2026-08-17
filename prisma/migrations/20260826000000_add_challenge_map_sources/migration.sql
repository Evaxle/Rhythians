-- Challenge maps: track source for auto-imported Rhythia maps and URL submissions.

-- AlterTable
ALTER TABLE "ChallengeMap" ADD COLUMN "sourceBeatmapId" INTEGER;
ALTER TABLE "ChallengeMap" ADD COLUMN "sourceUrl" TEXT;
ALTER TABLE "ChallengeMap" ADD COLUMN "isAutoImported" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeMap_sourceBeatmapId_key" ON "ChallengeMap"("sourceBeatmapId");