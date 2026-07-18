-- 回滚：移除 platform 字段，恢复 username 全局唯一

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_platform_username;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_platform_login_name;
DROP INDEX IF EXISTS idx_users_platform;
DROP INDEX IF EXISTS idx_users_platform_username;
ALTER TABLE users DROP COLUMN IF EXISTS platform;

-- username 在 users 表中原本 NOT NULL 且有唯一约束
ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);
