-- 我的服务台菜单权限回填：前端菜单树新增"我的服务台"开关（/portal/workspace）后，
-- 该路径进入权限树已知路径集合，未勾选即隐藏导航入口。
-- 存量租户中 teacher/student 角色的 menus 未包含该路径，若不回填将导致标准角色丢失服务台入口。
-- 仅更新已配置 menus 的角色（school_admin 无 menus 表示不限制，保持不动）。
UPDATE roles
SET permissions = jsonb_set(
    permissions,
    '{menus,/portal/workspace}',
    'true',
    true
)
WHERE code IN ('teacher', 'student')
  AND permissions ? 'menus';
