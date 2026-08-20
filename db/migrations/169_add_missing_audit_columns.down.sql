-- 169 down: 移除补齐的审计列（不可逆：DROP 列丢失列数据，仅审计时间戳，风险低）
ALTER TABLE questions DROP COLUMN IF EXISTS updated_at;
ALTER TABLE certification_ability_items DROP COLUMN IF EXISTS created_at;
ALTER TABLE certification_ability_items DROP COLUMN IF EXISTS updated_at;
ALTER TABLE certification_ability_points DROP COLUMN IF EXISTS created_at;
ALTER TABLE certification_ability_points DROP COLUMN IF EXISTS updated_at;
ALTER TABLE certification_related_tasks DROP COLUMN IF EXISTS created_at;
ALTER TABLE certification_related_tasks DROP COLUMN IF EXISTS updated_at;
ALTER TABLE job_ability_aggregate_logs DROP COLUMN IF EXISTS created_at;
ALTER TABLE job_ability_aggregate_logs DROP COLUMN IF EXISTS updated_at;
ALTER TABLE job_ability_results DROP COLUMN IF EXISTS created_at;
ALTER TABLE job_ability_results DROP COLUMN IF EXISTS updated_at;
ALTER TABLE student_ability_archives DROP COLUMN IF EXISTS updated_at;
ALTER TABLE job_run_logs DROP COLUMN IF EXISTS created_at;
ALTER TABLE job_run_logs DROP COLUMN IF EXISTS updated_at;
ALTER TABLE resource_snapshots DROP COLUMN IF EXISTS updated_at;
