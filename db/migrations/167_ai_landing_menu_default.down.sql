-- 回滚：移除本迁移补入的落地页菜单勾选（幂等，仅清理实际存在的键）。
UPDATE roles
SET permissions = JSON_REMOVE(permissions, '$.menus."/portal/ai/landing"')
WHERE code IN ('teacher', 'student', 'school_admin')
  AND JSON_CONTAINS_PATH(permissions, 'one', '$.menus')
  AND JSON_CONTAINS(permissions, '"/portal/ai/landing"', '$.menus');
