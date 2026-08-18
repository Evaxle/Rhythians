-- Read-only authentication integrity check.
-- This intentionally does not delete users or content.
-- Run it in Supabase SQL Editor before deciding on a targeted reset.

SELECT
  u."id",
  u."username",
  u."profileHandle",
  u."discordId",
  u."passwordHash" IS NOT NULL AS "hasPassword",
  COUNT(DISTINCT s."id") AS "sessionCount",
  COUNT(DISTINCT rp."id") AS "rhythiaProfileCount"
FROM "User" u
LEFT JOIN "Session" s ON s."userId" = u."id"
LEFT JOIN "RhythiaProfile" rp ON rp."userId" = u."id"
WHERE NULLIF(BTRIM(u."username"), '') IS NULL
   OR NULLIF(BTRIM(u."profileHandle"), '') IS NULL
   OR (u."discordId" IS NULL AND u."passwordHash" IS NULL)
GROUP BY u."id", u."username", u."profileHandle", u."discordId", u."passwordHash"
ORDER BY u."createdAt";

-- Targeted reset preview. Replace the values before running.
-- SELECT u."id", u."username", u."profileHandle", u."discordId", u."email"
-- FROM "User" u
-- WHERE u."discordId" = '<DISCORD_ID>'
--    OR LOWER(u."username") = LOWER('<USERNAME>')
--    OR u."profileHandle" = '<PROFILE_HANDLE>';

-- Safe account-auth reset example. This preserves clips, comments, maps, and messages.
-- BEGIN;
-- CREATE TEMP TABLE auth_reset_users AS
-- SELECT u."id"
-- FROM "User" u
-- WHERE u."discordId" = '<DISCORD_ID>'
--    OR LOWER(u."username") = LOWER('<USERNAME>')
--    OR u."profileHandle" = '<PROFILE_HANDLE>';
-- DELETE FROM "Session" WHERE "userId" IN (SELECT "id" FROM auth_reset_users);
-- UPDATE "User"
-- SET "discordId" = NULL,
--     "passwordHash" = NULL,
--     "email" = NULL,
--     "onboardingCompleted" = FALSE,
--     "updatedAt" = NOW()
-- WHERE "id" IN (SELECT "id" FROM auth_reset_users);
-- COMMIT;
