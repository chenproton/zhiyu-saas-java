-- 回滚：移除本迁移补入的 /portal/workspace 勾选（仅清理实际存在的键，幂等）。
UPDATE roles
SET permissions = JSON_REMOVE(permissions, '$.menus."/portal/workspace"')
WHERE code IN ('teacher', 'student')
  AND JSON_CONTAINS_PATH(permissions, 'one', '$.menus')
  AND JSON_CONTAINS(permissions, '"/portal/workspace"', '$.menus');
