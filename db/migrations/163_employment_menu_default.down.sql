-- 回滚：移除本迁移补入的就业服务管理菜单勾选（仅清理实际存在的键，幂等）。
UPDATE roles
SET permissions = permissions
    #- '{menus,/portal/apps/alliance/employmentproject}'
    #- '{menus,/portal/apps/alliance/employmentjob}'
WHERE code = 'teacher'
  AND permissions ? 'menus'
  AND permissions -> 'menus' ? '/portal/apps/alliance/employmentproject';
