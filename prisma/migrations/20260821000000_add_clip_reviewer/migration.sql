-- Track which user (post-reviewer/admin) reviewed a clip and when.
ALTER TABLE "Clip" ADD COLUMN "reviewedById" TEXT;
ALTER TABLE "Clip" ADD COLUMN "reviewedAt" TIMESTAMP(3);

ALTER TABLE "Clip" ADD CONSTRAINT "Clip_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Clip_reviewedById_idx" ON "Clip"("reviewedById");