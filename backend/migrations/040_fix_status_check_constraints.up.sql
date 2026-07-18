-- 修复已部署环境可能存在的 CHECK 约束取值不完整问题，重新声明完整状态枚举

ALTER TABLE career_positions DROP CONSTRAINT IF EXISTS chk_career_positions_status;
ALTER TABLE career_positions ADD CONSTRAINT chk_career_positions_status
    CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'published', 'archived'));

ALTER TABLE scenarios DROP CONSTRAINT IF EXISTS chk_scenarios_status;
ALTER TABLE scenarios ADD CONSTRAINT chk_scenarios_status
    CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'published', 'archived'));

ALTER TABLE courses DROP CONSTRAINT IF EXISTS chk_courses_status;
ALTER TABLE courses ADD CONSTRAINT chk_courses_status
    CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'published', 'archived'));

ALTER TABLE question_banks DROP CONSTRAINT IF EXISTS chk_question_banks_status;
ALTER TABLE question_banks ADD CONSTRAINT chk_question_banks_status
    CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'published', 'archived'));

ALTER TABLE exams DROP CONSTRAINT IF EXISTS chk_exams_status;
ALTER TABLE exams ADD CONSTRAINT chk_exams_status
    CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'published', 'archived'));

ALTER TABLE questions DROP CONSTRAINT IF EXISTS chk_questions_status;
ALTER TABLE questions ADD CONSTRAINT chk_questions_status
    CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'published', 'archived'));
