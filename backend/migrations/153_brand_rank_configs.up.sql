-- 人才品牌画像排名启用配置（每专业是否展示 + 前 N 名上限）
CREATE TABLE IF NOT EXISTS brand_major_rank_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    major_id UUID NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    rank_limit INT NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, major_id)
);
CREATE INDEX idx_brand_rank_configs_tenant ON brand_major_rank_configs(tenant_id);
