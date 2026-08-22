ALTER TABLE "User"
ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN "emailTwoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "EmailVerification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailVerification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailMfaChallenge" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "redirectTo" TEXT,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailMfaChallenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailVerification_userId_createdAt_idx" ON "EmailVerification"("userId", "createdAt");
CREATE INDEX "EmailMfaChallenge_userId_createdAt_idx" ON "EmailMfaChallenge"("userId", "createdAt");

ALTER TABLE "EmailVerification"
ADD CONSTRAINT "EmailVerification_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailMfaChallenge"
ADD CONSTRAINT "EmailMfaChallenge_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
