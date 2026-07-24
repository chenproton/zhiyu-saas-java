-- 061_evaluation_methods_refactor
-- Replace old task_evaluation_configs tables with redesigned schema

-- Drop old unused tables (no frontend depends on them, no existing data)
DROP TABLE IF EXISTS task_eval_points CASCADE;
DROP TABLE IF EXISTS task_review_steps CASCADE;
DROP TABLE IF EXISTS task_evaluation_configs CASCADE;

-- Rubric/score rule templates (tenant-level, reusable across tasks)
CREATE TABLE rubric_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(256) NOT NULL,
    mode VARCHAR(16) NOT NULL CHECK (mode IN ('rubric', 'score_rule')),
    types VARCHAR(32)[] NOT NULL DEFAULT '{}',
    description TEXT,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_rubric_templates_tenant ON rubric_templates(tenant_id);

-- Task evaluation method config (one per task per method_key)
CREATE TABLE task_evaluation_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    task_id UUID NOT NULL REFERENCES scenario_tasks(id) ON DELETE CASCADE,
    method_key VARCHAR(32) NOT NULL,
    weight NUMERIC(5,2) NOT NULL DEFAULT 0,
    eval_object VARCHAR(16) NOT NULL DEFAULT 'individual',
    score_type VARCHAR(32),
    eval_subjects JSONB NOT NULL DEFAULT '[]',
    rubric_template_id UUID REFERENCES rubric_templates(id) ON DELETE SET NULL,
    resource_config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(task_id, method_key)
);

-- Evaluation points per method config
CREATE TABLE task_eval_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    config_id UUID NOT NULL REFERENCES task_evaluation_methods(id) ON DELETE CASCADE,
    name VARCHAR(256) NOT NULL,
    description TEXT,
    sub_type VARCHAR(32),
    types VARCHAR(32)[] NOT NULL DEFAULT '{}',
    weight NUMERIC(5,2) NOT NULL DEFAULT 0,
    scoring_method VARCHAR(16) NOT NULL DEFAULT 'level',
    grade_mapping JSONB NOT NULL DEFAULT '[]',
    knowledge_point_ids UUID[] NOT NULL DEFAULT '{}',
    ability_point_ids UUID[] NOT NULL DEFAULT '{}',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Review steps per method config (for review method)
CREATE TABLE task_review_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    config_id UUID NOT NULL REFERENCES task_evaluation_methods(id) ON DELETE CASCADE,
    label VARCHAR(64) NOT NULL,
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    subject_type VARCHAR(32),
    weight NUMERIC(5,2) NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
