-- 089_job_ability_detail.up.sql
-- 注：major_id 列已由 022_unify_major_industry_refs 添加
ALTER TABLE job_ability_results
  ADD COLUMN IF NOT EXISTS major_name VARCHAR(128),
  ADD COLUMN IF NOT EXISTS ability_point_details JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS grade_history JSONB NOT NULL DEFAULT '[]';

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_ability_results_user_position
  ON job_ability_results(career_position_id, user_id);

CREATE TABLE IF NOT EXISTS job_ability_aggregate_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  career_position_id UUID,
  status VARCHAR(16) NOT NULL DEFAULT 'running',
  student_count INT NOT NULL DEFAULT 0,
  updated_count INT NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_job_ability_aggregate_logs_position ON job_ability_aggregate_logs(tenant_id, career_position_id, started_at DESC);

-- 学生画像按 (user_id, career_position_id) 唯一，供汇聚后 upsert 使用
DELETE FROM student_ability_portraits a
USING student_ability_portraits b
WHERE a.user_id = b.user_id AND a.career_position_id = b.career_position_id
  AND (a.updated_at < b.updated_at OR (a.updated_at = b.updated_at AND a.ctid < b.ctid));

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_ability_portraits_user_position
  ON student_ability_portraits(user_id, career_position_id);
