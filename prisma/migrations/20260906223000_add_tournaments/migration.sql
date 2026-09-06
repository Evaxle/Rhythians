CREATE TABLE "Tournament" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'scheduled',
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tournament_mode_check" CHECK ("mode" IN ('1v1','2v2','3v3')),
  CONSTRAINT "Tournament_status_check" CHECK ("status" IN ('scheduled','active','completed','cancelled'))
);
CREATE INDEX "Tournament_status_scheduledAt_idx" ON "Tournament"("status","scheduledAt");
CREATE INDEX "Tournament_completedAt_idx" ON "Tournament"("completedAt");

CREATE TABLE "TournamentSignup" (
  "id" TEXT PRIMARY KEY,
  "tournamentId" TEXT NOT NULL REFERENCES "Tournament"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "split" TEXT NOT NULL,
  "requestedSplit" TEXT,
  "splitRequestStatus" TEXT NOT NULL DEFAULT 'none',
  "status" TEXT NOT NULL DEFAULT 'registered',
  "priority" BOOLEAN NOT NULL DEFAULT FALSE,
  "rankName" TEXT NOT NULL,
  "rankIndex" INTEGER NOT NULL,
  "rankTier" INTEGER NOT NULL,
  "rhpSnapshot" INTEGER NOT NULL,
  "signedUpAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TournamentSignup_split_check" CHECK ("split" IN ('lower','higher')),
  CONSTRAINT "TournamentSignup_requested_split_check" CHECK ("requestedSplit" IS NULL OR "requestedSplit" IN ('lower','higher')),
  CONSTRAINT "TournamentSignup_request_status_check" CHECK ("splitRequestStatus" IN ('none','pending','approved','denied')),
  CONSTRAINT "TournamentSignup_status_check" CHECK ("status" IN ('registered','accepted','waitlisted','withdrawn')),
  UNIQUE("tournamentId","userId")
);
CREATE INDEX "TournamentSignup_tournament_split_status_idx" ON "TournamentSignup"("tournamentId","split","status");
CREATE INDEX "TournamentSignup_tournament_request_idx" ON "TournamentSignup"("tournamentId","splitRequestStatus");

CREATE TABLE "TournamentMapPool" (
  "id" TEXT PRIMARY KEY,
  "tournamentId" TEXT NOT NULL REFERENCES "Tournament"("id") ON DELETE CASCADE,
  "split" TEXT NOT NULL,
  "mapId" TEXT NOT NULL REFERENCES "ChallengeMap"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TournamentMapPool_split_check" CHECK ("split" IN ('lower','higher')),
  UNIQUE("tournamentId","split","mapId")
);
CREATE INDEX "TournamentMapPool_tournament_split_idx" ON "TournamentMapPool"("tournamentId","split");

CREATE TABLE "TournamentTeam" (
  "id" TEXT PRIMARY KEY,
  "tournamentId" TEXT NOT NULL REFERENCES "Tournament"("id") ON DELETE CASCADE,
  "split" TEXT NOT NULL,
  "seed" INTEGER NOT NULL,
  "averageTier" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TournamentTeam_split_check" CHECK ("split" IN ('lower','higher')),
  UNIQUE("tournamentId","split","seed")
);
CREATE INDEX "TournamentTeam_tournament_split_idx" ON "TournamentTeam"("tournamentId","split");

CREATE TABLE "TournamentTeamMember" (
  "id" TEXT PRIMARY KEY,
  "tournamentId" TEXT NOT NULL REFERENCES "Tournament"("id") ON DELETE CASCADE,
  "teamId" TEXT NOT NULL REFERENCES "TournamentTeam"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "slot" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("teamId","userId"),
  UNIQUE("tournamentId","userId")
);
CREATE INDEX "TournamentTeamMember_team_idx" ON "TournamentTeamMember"("teamId");
CREATE INDEX "TournamentTeamMember_user_idx" ON "TournamentTeamMember"("userId");

CREATE TABLE "TournamentMatch" (
  "id" TEXT PRIMARY KEY,
  "tournamentId" TEXT NOT NULL REFERENCES "Tournament"("id") ON DELETE CASCADE,
  "split" TEXT NOT NULL,
  "round" INTEGER NOT NULL,
  "position" INTEGER NOT NULL,
  "side" TEXT NOT NULL,
  "team1Id" TEXT REFERENCES "TournamentTeam"("id") ON DELETE SET NULL,
  "team2Id" TEXT REFERENCES "TournamentTeam"("id") ON DELETE SET NULL,
  "winnerTeamId" TEXT REFERENCES "TournamentTeam"("id") ON DELETE SET NULL,
  "battleMatchId" TEXT UNIQUE REFERENCES "BattleMatch"("id") ON DELETE SET NULL,
  "mapId" TEXT REFERENCES "ChallengeMap"("id") ON DELETE SET NULL,
  "status" TEXT NOT NULL DEFAULT 'waiting',
  "countdownEndsAt" TIMESTAMP(3),
  "matchDeadlineAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TournamentMatch_split_check" CHECK ("split" IN ('lower','higher')),
  CONSTRAINT "TournamentMatch_side_check" CHECK ("side" IN ('left','right','final')),
  CONSTRAINT "TournamentMatch_status_check" CHECK ("status" IN ('waiting','countdown','activating','active','completed','needs_admin')),
  UNIQUE("tournamentId","split","round","position")
);
CREATE INDEX "TournamentMatch_tournament_status_idx" ON "TournamentMatch"("tournamentId","status");
CREATE INDEX "TournamentMatch_battle_idx" ON "TournamentMatch"("battleMatchId");

ALTER TABLE "Tournament" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TournamentSignup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TournamentMapPool" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TournamentTeam" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TournamentTeamMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TournamentMatch" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "Tournament" FROM anon, authenticated;
REVOKE ALL ON TABLE "TournamentSignup" FROM anon, authenticated;
REVOKE ALL ON TABLE "TournamentMapPool" FROM anon, authenticated;
REVOKE ALL ON TABLE "TournamentTeam" FROM anon, authenticated;
REVOKE ALL ON TABLE "TournamentTeamMember" FROM anon, authenticated;
REVOKE ALL ON TABLE "TournamentMatch" FROM anon, authenticated;
