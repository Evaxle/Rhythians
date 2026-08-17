-- Daily map streak tracking.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "dailyStreak" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "lastDailyBeatAt" TIMESTAMP(3);