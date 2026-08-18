-- Email is no longer collected by local registration or used to link Discord accounts.
-- Keep the nullable column for backwards-compatible schema/API reads, but remove
-- previously stored addresses from existing users.
UPDATE "User" SET "email" = NULL WHERE "email" IS NOT NULL;