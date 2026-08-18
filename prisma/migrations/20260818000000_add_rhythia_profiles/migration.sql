CREATE TABLE "RhythiaProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" INTEGER NOT NULL,
    "profileUrl" TEXT NOT NULL,
    "username" TEXT,
    "country" TEXT,
    "flag" TEXT,
    "globalRank" INTEGER,
    "countryRank" INTEGER,
    "rhythmPoints" DOUBLE PRECISION,
    "title" TEXT NOT NULL,
    "scores" JSONB NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RhythiaProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RhythiaProfile_userId_key" ON "RhythiaProfile"("userId");
CREATE UNIQUE INDEX "RhythiaProfile_profileId_key" ON "RhythiaProfile"("profileId");
ALTER TABLE "RhythiaProfile" ADD CONSTRAINT "RhythiaProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
