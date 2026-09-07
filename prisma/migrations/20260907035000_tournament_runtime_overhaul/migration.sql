ALTER TABLE "Tournament"
  ADD COLUMN IF NOT EXISTS "targetPlayersPerSplit" INTEGER,
  ADD COLUMN IF NOT EXISTS "matchDurationSeconds" INTEGER NOT NULL DEFAULT 600,
  ADD COLUMN IF NOT EXISTS "intermissionSeconds" INTEGER NOT NULL DEFAULT 300;

ALTER TABLE "Tournament" DROP CONSTRAINT IF EXISTS "Tournament_target_players_check";
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_target_players_check" CHECK ("targetPlayersPerSplit" IS NULL OR "targetPlayersPerSplit" IN (4,8,12,16,24,32,48));
ALTER TABLE "Tournament" DROP CONSTRAINT IF EXISTS "Tournament_match_duration_check";
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_match_duration_check" CHECK ("matchDurationSeconds" BETWEEN 300 AND 1800);
ALTER TABLE "Tournament" DROP CONSTRAINT IF EXISTS "Tournament_intermission_check";
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_intermission_check" CHECK ("intermissionSeconds" BETWEEN 300 AND 600);

ALTER TABLE "TournamentSignup" DROP CONSTRAINT IF EXISTS "TournamentSignup_status_check";
ALTER TABLE "TournamentSignup" ADD CONSTRAINT "TournamentSignup_status_check" CHECK ("status" IN ('registered','accepted','waitlisted','withdrawn','kicked'));

ALTER TABLE "TournamentMatch"
  ADD COLUMN IF NOT EXISTS "mapRevealAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "playStartsAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "forfeitReason" TEXT;

ALTER TABLE "TournamentMatch" DROP CONSTRAINT IF EXISTS "TournamentMatch_status_check";
ALTER TABLE "TournamentMatch" ADD CONSTRAINT "TournamentMatch_status_check" CHECK ("status" IN ('waiting','intermission','map_countdown','map_ready','countdown','activating','active','completed','needs_admin'));
CREATE INDEX IF NOT EXISTS "TournamentMatch_phase_idx" ON "TournamentMatch"("tournamentId","status","countdownEndsAt");
CREATE INDEX IF NOT EXISTS "TournamentMatch_assigned_map_idx" ON "TournamentMatch"("tournamentId","split","mapId");

CREATE TABLE IF NOT EXISTS "TournamentPresence" (
  "id" TEXT PRIMARY KEY,
  "tournamentId" TEXT NOT NULL REFERENCES "Tournament"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "split" TEXT NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "warningStage" INTEGER NOT NULL DEFAULT 0,
  "kickedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TournamentPresence_split_check" CHECK ("split" IN ('lower','higher')),
  CONSTRAINT "TournamentPresence_warning_check" CHECK ("warningStage" BETWEEN 0 AND 3),
  UNIQUE("tournamentId","userId")
);
CREATE INDEX IF NOT EXISTS "TournamentPresence_idle_idx" ON "TournamentPresence"("tournamentId","kickedAt","lastSeenAt");

CREATE TABLE IF NOT EXISTS "TournamentChatMessage" (
  "id" TEXT PRIMARY KEY,
  "tournamentId" TEXT NOT NULL REFERENCES "Tournament"("id") ON DELETE CASCADE,
  "split" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TournamentChatMessage_split_check" CHECK ("split" IN ('lower','higher')),
  CONSTRAINT "TournamentChatMessage_content_check" CHECK (char_length("content") BETWEEN 1 AND 500)
);
CREATE INDEX IF NOT EXISTS "TournamentChatMessage_feed_idx" ON "TournamentChatMessage"("tournamentId","split","createdAt" DESC);
CREATE INDEX IF NOT EXISTS "TournamentChatMessage_user_idx" ON "TournamentChatMessage"("userId","createdAt" DESC);

CREATE TABLE IF NOT EXISTS "TournamentNotificationLog" (
  "id" TEXT PRIMARY KEY,
  "tournamentId" TEXT NOT NULL REFERENCES "Tournament"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "eventKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("tournamentId","userId","eventKey")
);
CREATE INDEX IF NOT EXISTS "TournamentNotificationLog_tournament_idx" ON "TournamentNotificationLog"("tournamentId","createdAt" DESC);

ALTER TABLE "TournamentPresence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TournamentChatMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TournamentNotificationLog" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "TournamentPresence" FROM anon, authenticated;
REVOKE ALL ON TABLE "TournamentChatMessage" FROM anon, authenticated;
REVOKE ALL ON TABLE "TournamentNotificationLog" FROM anon, authenticated;
