INSERT INTO "Tag" ("id", "name", "slug", "createdAt")
VALUES ('8b7b9b5f-4f75-4b1a-9f4c-6d5b9f1e7a20', 'Staff', 'staff', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET "name" = EXCLUDED."name";