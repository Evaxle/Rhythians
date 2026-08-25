CREATE TABLE IF NOT EXISTS "SettingsShowcase" (
  "id" TEXT NOT NULL,
  "cameraMode" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "settingsFileUrl" TEXT NOT NULL,
  "settingsFileName" TEXT NOT NULL,
  "videoUrl" TEXT NOT NULL,
  "title" TEXT,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SettingsShowcase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SettingsShowcase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SettingsShowcase_cameraMode_check" CHECK ("cameraMode" IN ('lock','spin'))
);
CREATE INDEX IF NOT EXISTS "SettingsShowcase_cameraMode_idx" ON "SettingsShowcase"("cameraMode");
CREATE INDEX IF NOT EXISTS "SettingsShowcase_userId_idx" ON "SettingsShowcase"("userId");