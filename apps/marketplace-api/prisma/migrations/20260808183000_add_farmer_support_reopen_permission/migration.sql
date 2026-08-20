INSERT INTO "Permission" ("id", "code", "description", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'support-tickets:reopen:own',
  'Reopen own resolved or closed support tickets',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO UPDATE
SET
  "description" = EXCLUDED."description",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "RolePermission" ("id", "role", "permissionId", "createdAt")
SELECT
  gen_random_uuid(),
  'FARMER'::"PlatformRole",
  permission."id",
  CURRENT_TIMESTAMP
FROM "Permission" AS permission
WHERE permission."code" = 'support-tickets:reopen:own'
ON CONFLICT ("role", "permissionId") DO NOTHING;
