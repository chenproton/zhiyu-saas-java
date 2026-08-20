-- 就业服务管理菜单权限回填：前端联盟导航新增「就业服务管理」分组
-- （/portal/apps/alliance/employmentproject、/portal/apps/alliance/employmentjob）后，
-- 该路径进入权限树已知路径集合，未勾选即隐藏导航入口。
-- 存量租户 teacher 角色的 menus 未包含新路径，若不回填将丢失入口；school_admin 无 menus 表示不限制，保持不动。
UPDATE roles
SET permissions = JSON_SET(
    JSON_SET(
        permissions,
        '$.menus."/portal/apps/alliance/employmentproject"',
        TRUE
    ),
    '$.menus."/portal/apps/alliance/employmentjob"',
    TRUE
)
WHERE code = 'teacher'
  AND JSON_CONTAINS_PATH(permissions, 'one', '$.menus');
