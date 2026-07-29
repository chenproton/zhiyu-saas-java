-- 090 down: 回滚等级字段加宽与规则全局等级映射
ALTER TABLE certification_rules DROP COLUMN IF EXISTS level_mapping;
ALTER TABLE certification_ability_points ALTER COLUMN required_level TYPE VARCHAR(4);
ALTER TABLE student_ability_portraits ALTER COLUMN overall_grade TYPE VARCHAR(4);
ALTER TABLE job_ability_results ALTER COLUMN grade TYPE VARCHAR(4);
