-- AI 平台前台落地页（/portal/ai/landing）纳入权限树后的存量回填（参照 163/166 模式）：
-- teacher/student（menus 已配置）与配置过 menus 的 school_admin 默认授予；
-- 无 menus 的 school_admin 不限制，保持不动；企业侧角色不使用门户，不回填。
UPDATE roles
SET permissions = JSON_SET(permissions, '$.menus."/portal/ai/landing"', TRUE)
WHERE code IN ('teacher', 'student', 'school_admin')
  AND JSON_CONTAINS_PATH(permissions, 'one', '$.menus');
