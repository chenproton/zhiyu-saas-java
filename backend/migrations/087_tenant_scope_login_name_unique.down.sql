DROP INDEX IF EXISTS uq_users_tenant_platform_login;
ALTER TABLE users ADD CONSTRAINT users_platform_login_name UNIQUE (platform, login_name);
