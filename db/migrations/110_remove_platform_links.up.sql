-- 移除平台跳转地址与应用服务子模块配置
-- 固定地址已统一收敛到前端 navigation-config.ts，不再需要库表支撑
DROP TABLE IF EXISTS app_modules;
DROP TABLE IF EXISTS platform_links;
