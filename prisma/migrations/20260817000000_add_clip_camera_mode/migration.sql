-- Camera mode for clips.

-- CreateEnum
CREATE TYPE "CameraMode" AS ENUM ('lock', 'spin', 'vr');

-- AlterTable
ALTER TABLE "Clip" ADD COLUMN "cameraMode" "CameraMode";
