-- Category system: skill categories (jumps, stream, tech, off grid) with
-- levels 1-10. Users start at level 0 in every category and must pass one map
-- at their current level + 1 to level up (no skipping).

-- CreateEnum
CREATE TYPE "CategoryType" AS ENUM ('jumps', 'stream', 'tech', 'off_grid');

-- CreateEnum
CREATE TYPE "CategoryMapStatus" AS ENUM ('pending', 'approved', 'rejected', 'hidden');

-- CreateTable
CREATE TABLE "CategoryMap" (
    "id" TEXT NOT NULL,
    "category" "CategoryType" NOT NULL,
    "level" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT,
    "description" TEXT,
    "mapFileUrl" TEXT NOT NULL,
    "imageUrl" TEXT,
    "mapperName" TEXT,
    "noteCount" INTEGER,
    "length" INTEGER,
    "sourceBeatmapId" INTEGER,
    "sourceUrl" TEXT,
    "submittedById" TEXT NOT NULL,
    "status" "CategoryMapStatus" NOT NULL DEFAULT 'pending',
    "reviewerNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryMapCompletion" (
    "id" TEXT NOT NULL,
    "categoryMapId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "scoreId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategoryMapCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCategoryLevel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "CategoryType" NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCategoryLevel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CategoryMap_sourceBeatmapId_key" ON "CategoryMap"("sourceBeatmapId");

-- CreateIndex
CREATE INDEX "CategoryMap_category_level_idx" ON "CategoryMap"("category", "level");

-- CreateIndex
CREATE INDEX "CategoryMap_status_idx" ON "CategoryMap"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryMapCompletion_categoryMapId_userId_key" ON "CategoryMapCompletion"("categoryMapId", "userId");

-- CreateIndex
CREATE INDEX "CategoryMapCompletion_userId_idx" ON "CategoryMapCompletion"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCategoryLevel_userId_category_key" ON "UserCategoryLevel"("userId", "category");

-- AddForeignKey
ALTER TABLE "CategoryMap" ADD CONSTRAINT "CategoryMap_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryMap" ADD CONSTRAINT "CategoryMap_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryMapCompletion" ADD CONSTRAINT "CategoryMapCompletion_categoryMapId_fkey" FOREIGN KEY ("categoryMapId") REFERENCES "CategoryMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryMapCompletion" ADD CONSTRAINT "CategoryMapCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCategoryLevel" ADD CONSTRAINT "UserCategoryLevel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
