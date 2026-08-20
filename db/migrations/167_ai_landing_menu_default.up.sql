-- AI 平台前台落地页（/portal/ai/landing）纳入权限树后的存量回填（参照 163/166 模式）：
-- teacher/student（menus 已配置）与配置过 menus 的 school_admin 默认授予；
-- 无 menus 的 school_admin 不限制，保持不动；企业侧角色不使用门户，不回填。
UPDATE roles
SET permissions = jsonb_set(permissions, '{menus,/portal/ai/landing}', 'true', true)
WHERE code IN ('teacher', 'student', 'school_admin')
  AND permissions ? 'menus';
