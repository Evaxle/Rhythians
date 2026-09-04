CREATE TABLE "RhythiaModeScore" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "mapKey" TEXT NOT NULL,
  "mapTitle" TEXT NOT NULL,
  "scoreId" INTEGER NOT NULL,
  "cameraMode" "CameraMode" NOT NULL,
  "points" INTEGER NOT NULL,
  "accuracy" DOUBLE PRECISION,
  "awardedSp" DOUBLE PRECISION,
  "speed" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RhythiaModeScore_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RhythiaModeScore_userId_mapKey_cameraMode_key" ON "RhythiaModeScore"("userId", "mapKey", "cameraMode");
CREATE UNIQUE INDEX "RhythiaModeScore_userId_scoreId_cameraMode_key" ON "RhythiaModeScore"("userId", "scoreId", "cameraMode");
CREATE INDEX "RhythiaModeScore_cameraMode_points_idx" ON "RhythiaModeScore"("cameraMode", "points");
CREATE INDEX "RhythiaModeScore_userId_cameraMode_idx" ON "RhythiaModeScore"("userId", "cameraMode");
ALTER TABLE "RhythiaModeScore" ADD CONSTRAINT "RhythiaModeScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
