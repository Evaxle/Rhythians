CREATE TABLE "UserPointOverride" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "system" TEXT NOT NULL CHECK ("system" IN ('rhp','rpl','rps','rpv')),
  "points" INTEGER NOT NULL CHECK ("points" >= 0),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("userId","system")
);
CREATE INDEX "UserPointOverride_userId_idx" ON "UserPointOverride"("userId");
