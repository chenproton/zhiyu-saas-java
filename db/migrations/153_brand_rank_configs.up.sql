-- 人才品牌画像排名启用配置（每专业是否展示 + 前 N 名上限）
CREATE TABLE IF NOT EXISTS brand_major_rank_configs (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL,
    major_id CHAR(36) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT 1,
    rank_limit INT NOT NULL DEFAULT 10,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tenant_id, major_id)
);
CREATE INDEX idx_brand_rank_configs_tenant ON brand_major_rank_configs(tenant_id);
