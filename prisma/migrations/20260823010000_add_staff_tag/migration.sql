INSERT INTO "Tag" ("id", "name", "slug")
VALUES (gen_random_uuid(), 'Staff', 'staff')
ON CONFLICT ("slug") DO UPDATE SET "name" = EXCLUDED."name";
