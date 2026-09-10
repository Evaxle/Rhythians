CREATE TABLE IF NOT EXISTS "SuggestionPost" (
  "id" TEXT PRIMARY KEY,
  "authorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "SuggestionVote" (
  "id" TEXT PRIMARY KEY,
  "suggestionId" TEXT NOT NULL REFERENCES "SuggestionPost"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SuggestionVote_suggestionId_userId_key" UNIQUE ("suggestionId","userId")
);
CREATE TABLE IF NOT EXISTS "SuggestionComment" (
  "id" TEXT PRIMARY KEY,
  "suggestionId" TEXT NOT NULL REFERENCES "SuggestionPost"("id") ON DELETE CASCADE,
  "authorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "SuggestionPost_createdAt_idx" ON "SuggestionPost"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "SuggestionVote_suggestionId_idx" ON "SuggestionVote"("suggestionId");
CREATE INDEX IF NOT EXISTS "SuggestionComment_suggestionId_createdAt_idx" ON "SuggestionComment"("suggestionId","createdAt");
ALTER TABLE "SuggestionPost" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SuggestionVote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SuggestionComment" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "SuggestionPost", "SuggestionVote", "SuggestionComment" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "SuggestionPost", "SuggestionVote", "SuggestionComment" TO service_role;
