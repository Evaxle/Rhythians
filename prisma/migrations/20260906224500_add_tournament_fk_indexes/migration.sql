CREATE INDEX "Tournament_createdById_idx" ON "Tournament"("createdById");
CREATE INDEX "TournamentSignup_userId_idx" ON "TournamentSignup"("userId");
CREATE INDEX "TournamentMapPool_mapId_idx" ON "TournamentMapPool"("mapId");
CREATE INDEX "TournamentMatch_team1Id_idx" ON "TournamentMatch"("team1Id");
CREATE INDEX "TournamentMatch_team2Id_idx" ON "TournamentMatch"("team2Id");
CREATE INDEX "TournamentMatch_winnerTeamId_idx" ON "TournamentMatch"("winnerTeamId");
CREATE INDEX "TournamentMatch_mapId_idx" ON "TournamentMatch"("mapId");
