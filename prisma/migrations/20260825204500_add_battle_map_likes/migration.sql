CREATE TABLE "BattleMatchMapLike" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "mapId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BattleMatchMapLike_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BattleMatchMapLike_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "BattleMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BattleMatchMapLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BattleMatchMapLike_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "ChallengeMap"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BattleMatchMapLike_matchId_userId_key" ON "BattleMatchMapLike"("matchId","userId");
CREATE INDEX "BattleMatchMapLike_matchId_idx" ON "BattleMatchMapLike"("matchId");
