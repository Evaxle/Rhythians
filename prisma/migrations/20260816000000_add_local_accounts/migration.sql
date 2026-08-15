-- Local (non-Discord) account support.

-- AlterEnum
ALTER TYPE "TagSource" ADD VALUE IF NOT EXISTS 'onboarding';

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "discordId" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "User" ADD COLUMN "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;
