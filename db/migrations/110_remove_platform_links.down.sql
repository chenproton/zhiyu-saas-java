-- 回滚：恢复 platform_links 与 app_modules 表（结构与 001_baseline 一致）
-- 注意：up 中 DROP TABLE 删除的存量配置数据不可逆（仅恢复表结构，历史数据不回填）。
SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
CREATE TABLE app_modules (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    platform VARCHAR(64) NOT NULL,
    title VARCHAR(128) NOT NULL,
    description LONGTEXT,
    href LONGTEXT,
    sort_order INT DEFAULT 0 NOT NULL,
    tenant_id CHAR(36)
);

CREATE TABLE platform_links (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    platform VARCHAR(64) NOT NULL,
    url LONGTEXT,
    enabled TINYINT(1) DEFAULT 1 NOT NULL,
    tenant_id CHAR(36)
);

ALTER TABLE app_modules
    ADD CONSTRAINT app_modules_pkey PRIMARY KEY (id);

ALTER TABLE platform_links
    ADD CONSTRAINT platform_links_pkey PRIMARY KEY (id);

ALTER TABLE platform_links
    ADD CONSTRAINT platform_links_platform_key UNIQUE (platform);

CREATE INDEX idx_app_modules_platform ON app_modules (platform);
CREATE INDEX idx_appmodules_tenant ON app_modules (tenant_id);
CREATE INDEX idx_platformlinks_tenant ON platform_links (tenant_id);

ALTER TABLE app_modules
    ADD CONSTRAINT fk_app_modules_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE platform_links
    ADD CONSTRAINT fk_platform_links_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

SET FOREIGN_KEY_CHECKS = 1;