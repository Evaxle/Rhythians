ALTER TABLE "Tournament"
  ADD COLUMN IF NOT EXISTS "postponedFrom" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "postponedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "postponeReason" TEXT,
  ADD COLUMN IF NOT EXISTS "postponementCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Tournament"
  DROP CONSTRAINT IF EXISTS "Tournament_postponementCount_check";

ALTER TABLE "Tournament"
  ADD CONSTRAINT "Tournament_postponementCount_check"
  CHECK ("postponementCount" >= 0);
