-- 回滚：删除新增的 code 列与唯一索引。注意 scenarios/courses 的旧 code 数据无法自动恢复。

DROP INDEX IF EXISTS uq_career_positions_tenant_code;
DROP INDEX IF EXISTS uq_question_banks_tenant_code;
DROP INDEX IF EXISTS uq_questions_tenant_code;
DROP INDEX IF EXISTS uq_exams_tenant_code;

ALTER TABLE career_positions DROP COLUMN IF EXISTS code;
ALTER TABLE question_banks DROP COLUMN IF EXISTS code;
ALTER TABLE questions DROP COLUMN IF EXISTS code;
ALTER TABLE exams DROP COLUMN IF EXISTS code;
