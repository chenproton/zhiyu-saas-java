-- 修复登录名唯一约束：按 platform + login_name 联合唯一，支持同一用户名在不同平台共存

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_login_name_key;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_platform_login_name;
ALTER TABLE users ADD CONSTRAINT users_platform_login_name UNIQUE (platform, login_name);
