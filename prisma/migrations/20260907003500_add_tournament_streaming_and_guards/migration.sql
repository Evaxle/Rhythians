ALTER TABLE "TournamentSignup"
  ADD COLUMN "streamOptIn" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "streamPlatform" TEXT,
  ADD COLUMN "streamIdentity" TEXT;

ALTER TABLE "TournamentSignup"
  ADD CONSTRAINT "TournamentSignup_stream_platform_check"
  CHECK ("streamPlatform" IS NULL OR "streamPlatform" IN ('steam','nightly')),
  ADD CONSTRAINT "TournamentSignup_stream_identity_check"
  CHECK ("streamIdentity" IS NULL OR "streamIdentity" IN ('discord','rhythia')),
  ADD CONSTRAINT "TournamentSignup_stream_shape_check"
  CHECK (
    ("streamOptIn" = FALSE AND "streamPlatform" IS NULL AND "streamIdentity" IS NULL)
    OR
    ("streamOptIn" = TRUE AND "streamPlatform" IS NOT NULL AND "streamIdentity" IS NOT NULL)
  );

ALTER TABLE "TournamentMatch"
  ADD COLUMN "team1Score" DOUBLE PRECISION,
  ADD COLUMN "team2Score" DOUBLE PRECISION;

CREATE UNIQUE INDEX "Tournament_single_active_idx"
  ON "Tournament" ((status))
  WHERE status = 'active';

CREATE INDEX "TournamentSignup_stream_opt_in_idx"
  ON "TournamentSignup" ("tournamentId","streamOptIn",status);
