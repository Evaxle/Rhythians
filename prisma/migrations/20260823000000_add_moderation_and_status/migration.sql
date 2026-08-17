-- User moderation (time-limited suspension, muting) and warnings.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "suspendedUntil" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "mutedUntil" TIMESTAMP(3);

-- Rhythia online status cache
ALTER TABLE "RhythiaProfile" ADD COLUMN "isOnline" BOOLEAN;
ALTER TABLE "RhythiaProfile" ADD COLUMN "lastActiveAt" TIMESTAMP(3);
ALTER TABLE "RhythiaProfile" ADD COLUMN "statusCheckedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "UserWarning" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserWarning_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserWarning_userId_idx" ON "UserWarning"("userId");

-- AddForeignKey
ALTER TABLE "UserWarning" ADD CONSTRAINT "UserWarning_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserWarning" ADD CONSTRAINT "UserWarning_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;