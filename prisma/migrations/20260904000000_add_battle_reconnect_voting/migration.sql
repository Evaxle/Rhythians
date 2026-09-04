ALTER TABLE "BattleMatch" ADD COLUMN IF NOT EXISTS "responseDeadlineAt" TIMESTAMP(3);
ALTER TABLE "BattleMatchPlayer" ADD COLUMN IF NOT EXISTS "scoreSubmittedAt" TIMESTAMP(3);
ALTER TABLE "BattleMatchPlayer" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3);
ALTER TABLE "BattleMatchPlayer" ADD COLUMN IF NOT EXISTS "disconnectedAt" TIMESTAMP(3);
ALTER TABLE "BattleMatchPlayer" ADD COLUMN IF NOT EXISTS "reconnectUntilAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "BattleMatch_responseDeadlineAt_idx" ON "BattleMatch"("responseDeadlineAt");
CREATE INDEX IF NOT EXISTS "BattleMatchPlayer_reconnectUntilAt_idx" ON "BattleMatchPlayer"("reconnectUntilAt");
CREATE TABLE IF NOT EXISTS "BattleMatchMapOption" (
  "id" TEXT PRIMARY KEY,
  "matchId" TEXT NOT NULL REFERENCES "BattleMatch"("id") ON DELETE CASCADE,
  "mapId" TEXT NOT NULL,
  "bucket" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("matchId","bucket"),
  UNIQUE("matchId","mapId")
);
CREATE INDEX IF NOT EXISTS "BattleMatchMapOption_matchId_idx" ON "BattleMatchMapOption"("matchId");
CREATE TABLE IF NOT EXISTS "BattleMatchMapVote" (
  "id" TEXT PRIMARY KEY,
  "matchId" TEXT NOT NULL REFERENCES "BattleMatch"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "mapId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("matchId","userId")
);
CREATE INDEX IF NOT EXISTS "BattleMatchMapVote_matchId_idx" ON "BattleMatchMapVote"("matchId");
CREATE TABLE IF NOT EXISTS "RbpMatchAward" (
  "id" TEXT PRIMARY KEY,
  "seasonId" TEXT NOT NULL REFERENCES "RbpSeason"("id") ON DELETE CASCADE,
  "matchId" TEXT NOT NULL REFERENCES "BattleMatch"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL,
  "delta" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("seasonId","matchId","userId","kind")
);
CREATE INDEX IF NOT EXISTS "RbpMatchAward_userId_createdAt_idx" ON "RbpMatchAward"("userId","createdAt");
