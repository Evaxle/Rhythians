-- Tracks when the last 24-hour Rhythia RP gain check ran for a user, so the
-- re-weighting of their RHP credit only happens once per day.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "lastRhythiaRpCheckAt" TIMESTAMP(3);
