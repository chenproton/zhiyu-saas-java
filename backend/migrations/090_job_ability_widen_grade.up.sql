-- 090_job_ability_detail: 加宽等级字段（自定义等级名可能超过 4 字符），认证规则增加全局等级映射
ALTER TABLE job_ability_results ALTER COLUMN grade TYPE VARCHAR(16);
ALTER TABLE student_ability_portraits ALTER COLUMN overall_grade TYPE VARCHAR(16);
ALTER TABLE certification_ability_points ALTER COLUMN required_level TYPE VARCHAR(16);
ALTER TABLE certification_rules ADD COLUMN IF NOT EXISTS level_mapping JSONB NOT NULL DEFAULT '[]';
