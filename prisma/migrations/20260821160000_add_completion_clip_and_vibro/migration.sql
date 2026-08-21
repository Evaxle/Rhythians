ALTER TYPE "CategoryType" ADD VALUE IF NOT EXISTS 'vibro';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CompletionClipStatus') THEN
    CREATE TYPE "CompletionClipStatus" AS ENUM ('pending', 'approved', 'rejected', 'hidden');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "CompletionClip" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "category" "CategoryType" NOT NULL,
  "level" INTEGER NOT NULL,
  "mapName" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "status" "CompletionClipStatus" NOT NULL DEFAULT 'pending',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewerNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompletionClip_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ChallengeCompletionClip" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "level" INTEGER NOT NULL,
  "mapName" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "status" "CompletionClipStatus" NOT NULL DEFAULT 'pending',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewerNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChallengeCompletionClip_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CompletionClip_status_createdAt_idx" ON "CompletionClip"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "CompletionClip_userId_category_level_idx" ON "CompletionClip"("userId", "category", "level");
CREATE INDEX IF NOT EXISTS "ChallengeCompletionClip_status_createdAt_idx" ON "ChallengeCompletionClip"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "ChallengeCompletionClip_userId_level_idx" ON "ChallengeCompletionClip"("userId", "level");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CompletionClip_userId_fkey') THEN
    ALTER TABLE "CompletionClip" ADD CONSTRAINT "CompletionClip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CompletionClip_reviewedById_fkey') THEN
    ALTER TABLE "CompletionClip" ADD CONSTRAINT "CompletionClip_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChallengeCompletionClip_userId_fkey') THEN
    ALTER TABLE "ChallengeCompletionClip" ADD CONSTRAINT "ChallengeCompletionClip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChallengeCompletionClip_reviewedById_fkey') THEN
    ALTER TABLE "ChallengeCompletionClip" ADD CONSTRAINT "ChallengeCompletionClip_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
