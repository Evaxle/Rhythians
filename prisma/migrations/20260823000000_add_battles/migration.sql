CREATE TABLE "BattleLobby" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "hostId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "mode" TEXT NOT NULL DEFAULT '1v1',
  "teamMode" TEXT NOT NULL DEFAULT 'regular',
  "matchType" TEXT NOT NULL DEFAULT 'casual',
  "status" TEXT NOT NULL DEFAULT 'open',
  "maxPlayers" INTEGER NOT NULL DEFAULT 30,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "BattleLobby_status_idx" ON "BattleLobby"("status");
CREATE TABLE "BattleLobbyMember" (
  "id" TEXT PRIMARY KEY,
  "lobbyId" TEXT NOT NULL REFERENCES "BattleLobby"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isReady" BOOLEAN NOT NULL DEFAULT FALSE,
  "isHost" BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE("lobbyId","userId")
);
CREATE INDEX "BattleLobbyMember_userId_idx" ON "BattleLobbyMember"("userId");
CREATE TABLE "BattleLobbyMessage" (
  "id" TEXT PRIMARY KEY,
  "lobbyId" TEXT NOT NULL REFERENCES "BattleLobby"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "BattleLobbyMessage_lobbyId_createdAt_idx" ON "BattleLobbyMessage"("lobbyId","createdAt");
CREATE TABLE "BattleLobbyMapVote" (
  "id" TEXT PRIMARY KEY,
  "lobbyId" TEXT NOT NULL REFERENCES "BattleLobby"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "mapId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("lobbyId","userId")
);
CREATE TABLE "BattleMatch" (
  "id" TEXT PRIMARY KEY,
  "matchType" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'waiting',
  "mapId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3)
);
CREATE INDEX "BattleMatch_status_idx" ON "BattleMatch"("status");
CREATE TABLE "BattleMatchPlayer" (
  "id" TEXT PRIMARY KEY,
  "matchId" TEXT NOT NULL REFERENCES "BattleMatch"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "team" INTEGER NOT NULL,
  "score" DOUBLE PRECISION,
  "accuracy" DOUBLE PRECISION,
  "scoreId" TEXT,
  "checkedAt" TIMESTAMP(3),
  UNIQUE("matchId","userId")
);
CREATE INDEX "BattleMatchPlayer_userId_idx" ON "BattleMatchPlayer"("userId");
CREATE TABLE "BattleInvite" (
  "id" TEXT PRIMARY KEY,
  "matchId" TEXT NOT NULL REFERENCES "BattleMatch"("id") ON DELETE CASCADE,
  "senderId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "receiverId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("matchId","receiverId")
);
CREATE INDEX "BattleInvite_receiverId_status_idx" ON "BattleInvite"("receiverId","status");
