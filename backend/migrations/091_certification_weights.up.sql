-- 091_certification_weights: 岗位能力认定两级权重（用户唯一可配置项）
-- task_id 为 NULL 表示"能力点占岗位总分"的权重行，否则为"任务占能力点得分"的权重行
CREATE TABLE IF NOT EXISTS certification_weights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES certification_rules(id) ON DELETE CASCADE,
    ability_point_id UUID NOT NULL,
    task_id UUID,
    weight NUMERIC(5,2) NOT NULL DEFAULT 0,
    tenant_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- task_id 可空，用 COALESCE 表达式索引保证 (rule, ability_point, task) 唯一
CREATE UNIQUE INDEX IF NOT EXISTS idx_certification_weights_unique
    ON certification_weights(rule_id, ability_point_id, COALESCE(task_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE INDEX IF NOT EXISTS idx_certification_weights_tenant ON certification_weights(tenant_id);
