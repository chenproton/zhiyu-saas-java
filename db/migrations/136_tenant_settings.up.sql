-- 租户级配置（键值），当前用于租户主题色覆盖
CREATE TABLE IF NOT EXISTS tenant_settings (
    tenant_id CHAR(36) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    value LONGTEXT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id, `key`)
);
