-- Rhythia verified flag on users.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "rhythiaVerified" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: anyone with a linked Rhythia profile is verified.
UPDATE "User" SET "rhythiaVerified" = true
WHERE id IN (SELECT "userId" FROM "RhythiaProfile");