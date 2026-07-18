-- 回滚场景域建表（004_scene_schema.up.sql）
DROP TABLE IF EXISTS scene_archives CASCADE;
DROP TABLE IF EXISTS scenario_grade_mappings CASCADE;
DROP TABLE IF EXISTS scenario_weight_configs CASCADE;
DROP TABLE IF EXISTS task_ability_bindings CASCADE;
DROP TABLE IF EXISTS task_knowledge_bindings CASCADE;
DROP TABLE IF EXISTS task_resource_bindings CASCADE;
DROP TABLE IF EXISTS task_resources CASCADE;
DROP TABLE IF EXISTS task_review_steps CASCADE;
DROP TABLE IF EXISTS task_eval_points CASCADE;
DROP TABLE IF EXISTS task_evaluation_configs CASCADE;
DROP TABLE IF EXISTS task_deliverables CASCADE;
DROP TABLE IF EXISTS scenario_tasks CASCADE;
DROP TABLE IF EXISTS scenarios CASCADE;
