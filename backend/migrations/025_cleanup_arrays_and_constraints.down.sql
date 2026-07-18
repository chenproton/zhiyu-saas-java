-- UP 回滚

-- 恢复 updated_at 删除
ALTER TABLE certification_rules DROP COLUMN IF EXISTS updated_at;
ALTER TABLE exam_results DROP COLUMN IF EXISTS updated_at;
ALTER TABLE student_ability_portraits DROP COLUMN IF EXISTS updated_at;

-- 恢复 UNIQUE
ALTER TABLE certification_rules DROP CONSTRAINT IF EXISTS uq_certification_rules_position;

-- 恢复 scenarios.industry_name
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS industry_name VARCHAR(128);

-- 恢复 evaluation_methods.target_ids
ALTER TABLE evaluation_methods ADD COLUMN target_ids UUID[] NOT NULL DEFAULT '{}';
DROP TABLE IF EXISTS evaluation_method_targets;

-- 恢复 question_banks.knowledge_point_ids
ALTER TABLE question_banks ADD COLUMN knowledge_point_ids UUID[] NOT NULL DEFAULT '{}';
DROP TABLE IF EXISTS question_bank_knowledge_points;

-- 恢复 system_course_nodes
ALTER TABLE system_course_nodes ADD COLUMN resource_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE system_course_nodes ADD COLUMN knowledge_point_ids UUID[] NOT NULL DEFAULT '{}';
DROP TABLE IF EXISTS node_resource_bindings;
DROP TABLE IF EXISTS node_knowledge_point_bindings;

-- 恢复 career_positions.major_ids
ALTER TABLE career_positions ADD COLUMN major_ids UUID[] NOT NULL DEFAULT '{}';

-- 恢复 scenario_tasks
ALTER TABLE scenario_tasks ADD COLUMN knowledge_point_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE scenario_tasks ADD COLUMN ability_point_ids UUID[] NOT NULL DEFAULT '{}';
