ALTER TABLE users DROP CONSTRAINT IF EXISTS users_tenant_platform_username;
ALTER TABLE users ADD CONSTRAINT users_platform_username UNIQUE (platform, username);
