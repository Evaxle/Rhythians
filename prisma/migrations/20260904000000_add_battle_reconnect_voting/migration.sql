ALTER TABLE "BattleMatch" ADD COLUMN "responseDeadlineAt" TIMESTAMP(3);
ALTER TABLE "BattleMatchPlayer" ADD COLUMN "scoreSubmittedAt" TIMESTAMP(3);
ALTER TABLE "BattleMatchPlayer" ADD COLUMN "lastSeenAt" TIMESTAMP(3);
ALTER TABLE "BattleMatchPlayer" ADD COLUMN "disconnectedAt" TIMESTAMP(3);
ALTER TABLE "BattleMatchPlayer" ADD COLUMN "reconnectUntilAt" TIMESTAMP(3);
CREATE INDEX "BattleMatch_responseDeadlineAt_idx" ON "BattleMatch"("responseDeadlineAt");
CREATE INDEX "BattleMatchPlayer_reconnectUntilAt_idx" ON "BattleMatchPlayer"("reconnectUntilAt");
CREATE TABLE "BattleMatchMapOption" (
  "id" TEXT PRIMARY KEY,
  "matchId" TEXT NOT NULL REFERENCES "BattleMatch"("id") ON DELETE CASCADE,
  "mapId" TEXT NOT NULL,
  "bucket" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("matchId","bucket"),
  UNIQUE("matchId","mapId")
);
CREATE INDEX "BattleMatchMapOption_matchId_idx" ON "BattleMatchMapOption"("matchId");
CREATE TABLE "BattleMatchMapVote" (
  "id" TEXT PRIMARY KEY,
  "matchId" TEXT NOT NULL REFERENCES "BattleMatch"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "mapId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("matchId","userId")
);
CREATE INDEX "BattleMatchMapVote_matchId_idx" ON "BattleMatchMapVote"("matchId");
CREATE TABLE "RbpMatchAward" (
  "id" TEXT PRIMARY KEY,
  "seasonId" TEXT NOT NULL REFERENCES "RbpSeason"("id") ON DELETE CASCADE,
  "matchId" TEXT NOT NULL REFERENCES "BattleMatch"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL,
  "delta" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("seasonId","matchId","userId","kind")
);
CREATE INDEX "RbpMatchAward_userId_createdAt_idx" ON "RbpMatchAward"("userId","createdAt");
