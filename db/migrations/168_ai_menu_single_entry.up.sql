-- AI 中心菜单收敛为单一开关：权限树中 chat/square/studio/landing 四个节点合并为
-- href=/portal/apps/ai 一个节点（前端 checkMenuPermission 向上回溯命中前缀授权）。
-- 存量角色迁移：凡持有任一旧授权键的角色补授 /portal/apps/ai，随后清理旧键
-- （166 的 chat/square/studio 三键、167 的 /portal/ai/landing 一键；landing 路径已并入
-- /portal/apps/ai/landing，旧 /portal/ai/landing 键作废）。
-- 管理组两路径（admin/reviews、admin/integrations）不在本次收敛范围，保持不变。
UPDATE roles
SET permissions = jsonb_set(permissions, '{menus,/portal/apps/ai}', 'true', true)
WHERE permissions ? 'menus'
  AND (
    permissions -> 'menus' ? '/portal/apps/ai/chat'
    OR permissions -> 'menus' ? '/portal/apps/ai/square'
    OR permissions -> 'menus' ? '/portal/apps/ai/studio'
    OR permissions -> 'menus' ? '/portal/ai/landing'
  );

UPDATE roles
SET permissions = permissions
    #- '{menus,/portal/apps/ai/chat}'
    #- '{menus,/portal/apps/ai/square}'
    #- '{menus,/portal/apps/ai/studio}'
    #- '{menus,/portal/ai/landing}'
WHERE permissions ? 'menus'
  AND (
    permissions -> 'menus' ? '/portal/apps/ai/chat'
    OR permissions -> 'menus' ? '/portal/apps/ai/square'
    OR permissions -> 'menus' ? '/portal/apps/ai/studio'
    OR permissions -> 'menus' ? '/portal/ai/landing'
  );
