-- 回滚：移除本迁移补入的 AI 中心菜单勾选（幂等，仅清理实际存在的键）。
-- 注：subscription_packages.modules.ai 的回填不逆向（移除会导致既有租户 AI 中心整体隐藏，属业务数据变更，不可逆符合规范）。
UPDATE roles
SET permissions = permissions
    #- '{menus,/portal/apps/ai/chat}'
    #- '{menus,/portal/apps/ai/square}'
    #- '{menus,/portal/apps/ai/studio}'
WHERE code IN ('teacher', 'student')
  AND permissions ? 'menus'
  AND permissions -> 'menus' ? '/portal/apps/ai/chat';

UPDATE roles
SET permissions = permissions
    #- '{menus,/portal/apps/ai/chat}'
    #- '{menus,/portal/apps/ai/square}'
    #- '{menus,/portal/apps/ai/studio}'
    #- '{menus,/portal/apps/ai/admin/reviews}'
    #- '{menus,/portal/apps/ai/admin/integrations}'
WHERE code = 'school_admin'
  AND permissions ? 'menus'
  AND permissions -> 'menus' ? '/portal/apps/ai/admin/reviews';
