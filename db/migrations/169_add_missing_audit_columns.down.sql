-- 169 down: 移除补齐的审计列（不可逆：DROP 列丢失列数据，仅审计时间戳，风险低）
SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
ALTER TABLE questions DROP COLUMN updated_at;
ALTER TABLE certification_ability_items DROP COLUMN created_at;
ALTER TABLE certification_ability_items DROP COLUMN updated_at;
ALTER TABLE certification_ability_points DROP COLUMN created_at;
ALTER TABLE certification_ability_points DROP COLUMN updated_at;
ALTER TABLE certification_related_tasks DROP COLUMN created_at;
ALTER TABLE certification_related_tasks DROP COLUMN updated_at;
ALTER TABLE job_ability_aggregate_logs DROP COLUMN created_at;
ALTER TABLE job_ability_aggregate_logs DROP COLUMN updated_at;
ALTER TABLE job_ability_results DROP COLUMN created_at;
ALTER TABLE job_ability_results DROP COLUMN updated_at;
ALTER TABLE student_ability_archives DROP COLUMN updated_at;
ALTER TABLE job_run_logs DROP COLUMN created_at;
ALTER TABLE job_run_logs DROP COLUMN updated_at;
ALTER TABLE resource_snapshots DROP COLUMN updated_at;

SET FOREIGN_KEY_CHECKS = 1;