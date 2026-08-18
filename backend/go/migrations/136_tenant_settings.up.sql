-- 租户级配置（键值），当前用于租户主题色覆盖
CREATE TABLE IF NOT EXISTS tenant_settings (
    tenant_id UUID NOT NULL,
    key       TEXT NOT NULL,
    value     TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, key)
);
