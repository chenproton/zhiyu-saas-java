-- 045: Add task detail fields for scenario task chain editor
-- Adds knowledge_point_ids, ability_point_ids, resource_ids arrays and eval_data JSONB to scenario_tasks
-- Adds category to knowledge_points for mock compatibility
-- Adds code, domain to ability_points for mock compatibility
-- Adds size, knowledge_point_ids to task_resources for mock compatibility

ALTER TABLE scenario_tasks ADD COLUMN IF NOT EXISTS knowledge_point_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE scenario_tasks ADD COLUMN IF NOT EXISTS ability_point_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE scenario_tasks ADD COLUMN IF NOT EXISTS resource_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE scenario_tasks ADD COLUMN IF NOT EXISTS eval_data JSONB NOT NULL DEFAULT '{}';

ALTER TABLE knowledge_points ADD COLUMN IF NOT EXISTS category VARCHAR(64);

ALTER TABLE ability_points ADD COLUMN IF NOT EXISTS code VARCHAR(64);
ALTER TABLE ability_points ADD COLUMN IF NOT EXISTS domain VARCHAR(128);

ALTER TABLE task_resources ADD COLUMN IF NOT EXISTS size VARCHAR(16);
ALTER TABLE task_resources ADD COLUMN IF NOT EXISTS knowledge_point_ids UUID[] NOT NULL DEFAULT '{}';
