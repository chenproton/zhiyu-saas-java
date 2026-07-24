-- 061_evaluation_methods_refactor.down.sql
-- Rollback: drop new tables and restore original task_evaluation_configs

DROP TABLE IF EXISTS task_eval_points CASCADE;
DROP TABLE IF EXISTS task_review_steps CASCADE;
DROP TABLE IF EXISTS task_evaluation_methods CASCADE;
DROP TABLE IF EXISTS rubric_templates CASCADE;

-- Restore original tables from migration 004
CREATE TABLE task_evaluation_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES scenario_tasks(id) ON DELETE CASCADE,
    method_key VARCHAR(32) NOT NULL,
    weight NUMERIC(5,2) NOT NULL DEFAULT 0,
    eval_objects JSONB DEFAULT '{}',
    eval_subjects JSONB DEFAULT '[]',
    eval_resources JSONB DEFAULT '{}',
    UNIQUE(task_id, method_key)
);

CREATE TABLE task_eval_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL REFERENCES task_evaluation_configs(id) ON DELETE CASCADE,
    name VARCHAR(256) NOT NULL,
    description TEXT,
    weight NUMERIC(5,2) NOT NULL DEFAULT 0,
    max_score NUMERIC(7,2) NOT NULL DEFAULT 100,
    scoring_method VARCHAR(16) NOT NULL DEFAULT 'score',
    grade_mapping JSONB DEFAULT '{}',
    sub_type VARCHAR(32),
    knowledge_point_ids UUID[] NOT NULL DEFAULT '{}',
    ability_point_ids UUID[] NOT NULL DEFAULT '{}',
    sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE task_review_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL REFERENCES task_evaluation_configs(id) ON DELETE CASCADE,
    label VARCHAR(64) NOT NULL,
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    subject_type VARCHAR(32),
    weight NUMERIC(5,2) NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0
);
