CREATE INDEX "Comment_clipId_createdAt_idx" ON "Comment"("clipId", "createdAt");
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");
