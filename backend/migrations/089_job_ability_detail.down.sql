-- 089_job_ability_detail.down.sql
DROP INDEX IF EXISTS idx_student_ability_portraits_user_position;

DROP TABLE IF EXISTS job_ability_aggregate_logs;

DROP INDEX IF EXISTS idx_job_ability_results_user_position;

ALTER TABLE job_ability_results
  DROP COLUMN IF EXISTS major_name,
  DROP COLUMN IF EXISTS ability_point_details,
  DROP COLUMN IF EXISTS grade_history;
