CREATE TYPE "RhythiaProfileRequestStatus" AS ENUM ('pending', 'approved', 'denied');

CREATE TABLE "RhythiaProfileRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" INTEGER NOT NULL,
    "profileUrl" TEXT NOT NULL,
    "rhythiaUsername" TEXT NOT NULL,
    "claimedUsername" TEXT NOT NULL,
    "status" "RhythiaProfileRequestStatus" NOT NULL DEFAULT 'pending',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    CONSTRAINT "RhythiaProfileRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RhythiaProfileRequest_status_idx" ON "RhythiaProfileRequest"("status");

ALTER TABLE "RhythiaProfileRequest" ADD CONSTRAINT "RhythiaProfileRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
