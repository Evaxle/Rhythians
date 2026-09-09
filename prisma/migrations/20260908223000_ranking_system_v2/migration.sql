CREATE TABLE IF NOT EXISTS "RankingBaseline" (
  "userId" text PRIMARY KEY REFERENCES "User"(id) ON DELETE CASCADE,
  "overallFloor" integer NOT NULL DEFAULT 0,
  "rplBase" integer NOT NULL DEFAULT 0,
  "rpsBase" integer NOT NULL DEFAULT 0,
  "rpvBase" integer NOT NULL DEFAULT 0,
  "source" text NOT NULL DEFAULT 'placement-v2',
  "lastResetId" uuid,
  "updatedAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "RankingResetAudit" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "resetId" uuid NOT NULL,
  "userId" text NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "oldRhp" integer NOT NULL,
  "newRhp" integer NOT NULL,
  "oldRpl" integer NOT NULL,
  "newRpl" integer NOT NULL,
  "oldRps" integer NOT NULL,
  "newRps" integer NOT NULL,
  "oldRpv" integer NOT NULL,
  "newRpv" integer NOT NULL,
  "oldRbp" integer,
  "newRbp" integer,
  "rhythiaGlobalRank" integer,
  "rhythiaRp" double precision,
  "metadata" jsonb,
  "createdAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "RankingResetAudit_resetId_idx" ON "RankingResetAudit"("resetId");
CREATE INDEX IF NOT EXISTS "RankingResetAudit_userId_idx" ON "RankingResetAudit"("userId");
