-- Daily maps and Rhythian Points (RHP).

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'rhp_earned';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "rhp" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DailyMap" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "beatmapId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT,
    "difficulty" INTEGER,
    "starRating" DOUBLE PRECISION NOT NULL,
    "noteCount" INTEGER,
    "length" INTEGER,
    "playcount" INTEGER,
    "mapHash" TEXT,
    "downloadUrl" TEXT NOT NULL,
    "imageUrl" TEXT,
    "mapperName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyMapBeat" (
    "id" TEXT NOT NULL,
    "dailyMapId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "scoreId" INTEGER,
    "accuracy" DOUBLE PRECISION,
    "misses" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyMapBeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RhpTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "dailyMapBeatId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RhpTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyMap_date_key" ON "DailyMap"("date");
CREATE INDEX "DailyMap_date_idx" ON "DailyMap"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyMapBeat_dailyMapId_userId_key" ON "DailyMapBeat"("dailyMapId", "userId");
CREATE INDEX "DailyMapBeat_userId_idx" ON "DailyMapBeat"("userId");

-- CreateIndex
CREATE INDEX "RhpTransaction_userId_idx" ON "RhpTransaction"("userId");
CREATE INDEX "RhpTransaction_createdAt_idx" ON "RhpTransaction"("createdAt");

-- AddForeignKey
ALTER TABLE "DailyMapBeat" ADD CONSTRAINT "DailyMapBeat_dailyMapId_fkey" FOREIGN KEY ("dailyMapId") REFERENCES "DailyMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyMapBeat" ADD CONSTRAINT "DailyMapBeat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RhpTransaction" ADD CONSTRAINT "RhpTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;