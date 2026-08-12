-- 回滚：移除本迁移补入的 /portal/workspace 勾选（仅清理实际存在的键，幂等）。
UPDATE roles
SET permissions = permissions #- '{menus,/portal/workspace}'
WHERE code IN ('teacher', 'student')
  AND permissions ? 'menus'
  AND permissions -> 'menus' ? '/portal/workspace';
