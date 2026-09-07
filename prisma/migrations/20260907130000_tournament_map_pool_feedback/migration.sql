ALTER TABLE "TournamentMapPool"
  ADD COLUMN IF NOT EXISTS "stage" TEXT NOT NULL DEFAULT 'regular',
  ADD COLUMN IF NOT EXISTS "autoSelected" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "sourcePlaycount" INTEGER,
  ADD COLUMN IF NOT EXISTS "replacedAt" TIMESTAMP(3);

DO $$ BEGIN
  ALTER TABLE "TournamentMapPool" ADD CONSTRAINT "TournamentMapPool_stage_check" CHECK ("stage" IN ('regular','finals'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "TournamentMapVote" (
  "id" TEXT PRIMARY KEY,
  "tournamentId" TEXT NOT NULL REFERENCES "Tournament"("id") ON DELETE CASCADE,
  "mapId" TEXT NOT NULL REFERENCES "ChallengeMap"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "value" SMALLINT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TournamentMapVote_value_check" CHECK ("value" IN (-1,1)),
  CONSTRAINT "TournamentMapVote_unique" UNIQUE ("tournamentId","mapId","userId")
);

CREATE TABLE IF NOT EXISTS "TournamentMapReport" (
  "id" TEXT PRIMARY KEY,
  "tournamentId" TEXT NOT NULL REFERENCES "Tournament"("id") ON DELETE CASCADE,
  "mapId" TEXT NOT NULL REFERENCES "ChallengeMap"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "TournamentMapReport_status_check" CHECK ("status" IN ('pending','resolved','dismissed')),
  CONSTRAINT "TournamentMapReport_unique" UNIQUE ("tournamentId","mapId","userId")
);

CREATE TABLE IF NOT EXISTS "TournamentMapRecommendation" (
  "id" TEXT PRIMARY KEY,
  "tournamentId" TEXT NOT NULL REFERENCES "Tournament"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "split" TEXT NOT NULL,
  "stage" TEXT NOT NULL DEFAULT 'regular',
  "mapUrl" TEXT NOT NULL,
  "sourceBeatmapId" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "TournamentMapRecommendation_split_check" CHECK ("split" IN ('lower','higher')),
  CONSTRAINT "TournamentMapRecommendation_stage_check" CHECK ("stage" IN ('regular','finals')),
  CONSTRAINT "TournamentMapRecommendation_status_check" CHECK ("status" IN ('pending','accepted','rejected'))
);

CREATE INDEX IF NOT EXISTS "TournamentMapVote_tournament_map_idx" ON "TournamentMapVote"("tournamentId","mapId");
CREATE INDEX IF NOT EXISTS "TournamentMapReport_tournament_status_idx" ON "TournamentMapReport"("tournamentId","status");
CREATE INDEX IF NOT EXISTS "TournamentMapRecommendation_tournament_status_idx" ON "TournamentMapRecommendation"("tournamentId","status");

ALTER TABLE "TournamentMapVote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TournamentMapReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TournamentMapRecommendation" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "TournamentMapVote" FROM anon, authenticated;
REVOKE ALL ON TABLE "TournamentMapReport" FROM anon, authenticated;
REVOKE ALL ON TABLE "TournamentMapRecommendation" FROM anon, authenticated;