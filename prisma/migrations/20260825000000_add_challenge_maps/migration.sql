-- Challenge maps (ranked by the site) and the RHP ranked ladder.

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'map_approved';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'map_rejected';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'rank_change';

-- CreateEnum
CREATE TYPE "ChallengeMapStatus" AS ENUM ('pending', 'approved', 'rejected', 'hidden');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "avgMapRating" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "ChallengeMap" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT,
    "description" TEXT,
    "mapFileUrl" TEXT NOT NULL,
    "imageUrl" TEXT,
    "requestedRating" DOUBLE PRECISION NOT NULL,
    "rating" DOUBLE PRECISION,
    "mapperName" TEXT,
    "noteCount" INTEGER,
    "length" INTEGER,
    "submittedById" TEXT NOT NULL,
    "status" "ChallengeMapStatus" NOT NULL DEFAULT 'pending',
    "reviewerNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeMapCompletion" (
    "id" TEXT NOT NULL,
    "challengeMapId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "passed" BOOLEAN NOT NULL,
    "points" INTEGER NOT NULL,
    "scoreId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeMapCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChallengeMap_status_idx" ON "ChallengeMap"("status");
CREATE INDEX "ChallengeMap_rating_idx" ON "ChallengeMap"("rating");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeMapCompletion_challengeMapId_userId_key" ON "ChallengeMapCompletion"("challengeMapId", "userId");
CREATE INDEX "ChallengeMapCompletion_userId_idx" ON "ChallengeMapCompletion"("userId");

-- AddForeignKey
ALTER TABLE "ChallengeMap" ADD CONSTRAINT "ChallengeMap_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChallengeMap" ADD CONSTRAINT "ChallengeMap_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChallengeMapCompletion" ADD CONSTRAINT "ChallengeMapCompletion_challengeMapId_fkey" FOREIGN KEY ("challengeMapId") REFERENCES "ChallengeMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChallengeMapCompletion" ADD CONSTRAINT "ChallengeMapCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;