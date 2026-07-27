ALTER TABLE users DROP CONSTRAINT IF EXISTS users_platform_login_name;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_tenant_platform_login ON users (tenant_id, platform, login_name);
