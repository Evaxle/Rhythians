-- Tracks whether a user has run the one-time historical score import.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "scoreImportDone" BOOLEAN NOT NULL DEFAULT false;