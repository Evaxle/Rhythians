CREATE UNIQUE INDEX IF NOT EXISTS "Tournament_scheduled_identity_key"
ON "Tournament" (LOWER(BTRIM(name)), mode, "scheduledAt")
WHERE status = 'scheduled';
