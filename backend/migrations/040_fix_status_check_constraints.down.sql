-- 回滚 040：移除重新声明的 CHECK 约束

ALTER TABLE career_positions DROP CONSTRAINT IF EXISTS chk_career_positions_status;
ALTER TABLE scenarios DROP CONSTRAINT IF EXISTS chk_scenarios_status;
ALTER TABLE courses DROP CONSTRAINT IF EXISTS chk_courses_status;
ALTER TABLE question_banks DROP CONSTRAINT IF EXISTS chk_question_banks_status;
ALTER TABLE exams DROP CONSTRAINT IF EXISTS chk_exams_status;
ALTER TABLE questions DROP CONSTRAINT IF EXISTS chk_questions_status;
