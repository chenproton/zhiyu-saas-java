-- AI 智能服务中心纳入菜单权限树（前端 menu-permissions.ts buildMenuTree 新增 ai 平台组）：
-- 权限树已知路径若角色 menus 未勾选即隐藏入口并拦截访问。
-- 存量角色回填（参照 163 模式）：
--   teacher/student（menus 已配置）→ 授予 AI 助手/AI 广场/我的工坊 三路径（AI 中心面向全体师生，见 spec ai-service-center §2.1）；
--   school_admin 无 menus 表示不限制，保持不动；个别配置了 menus 的 school_admin 行补齐全部五路径（含管理组）；
--   企业侧角色（enterprise_*）不使用门户 AI 中心，不回填。
-- 同时将存量订阅包 modules 补齐 ai=true（缺失时前端 subscriptionModules 门禁会整体隐藏 AI 中心）。
UPDATE roles
SET permissions = jsonb_set(
    jsonb_set(
        jsonb_set(permissions, '{menus,/portal/apps/ai/chat}', 'true', true),
        '{menus,/portal/apps/ai/square}', 'true', true
    ),
    '{menus,/portal/apps/ai/studio}', 'true', true
)
WHERE code IN ('teacher', 'student')
  AND permissions ? 'menus';

UPDATE roles
SET permissions = jsonb_set(
    jsonb_set(
        jsonb_set(
            jsonb_set(
                jsonb_set(permissions, '{menus,/portal/apps/ai/chat}', 'true', true),
                '{menus,/portal/apps/ai/square}', 'true', true
            ),
            '{menus,/portal/apps/ai/studio}', 'true', true
        ),
        '{menus,/portal/apps/ai/admin/reviews}', 'true', true
    ),
    '{menus,/portal/apps/ai/admin/integrations}', 'true', true
)
WHERE code = 'school_admin'
  AND permissions ? 'menus';

UPDATE subscription_packages
SET modules = jsonb_set(modules, '{ai}', 'true', true)
WHERE NOT (modules ? 'ai');
