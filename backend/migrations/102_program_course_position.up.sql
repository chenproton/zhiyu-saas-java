-- 删除 scenario_id，新增 position_id，清空旧数据
DELETE FROM training_program_courses;

ALTER TABLE training_program_courses DROP COLUMN IF EXISTS scenario_id;
ALTER TABLE training_program_courses ADD COLUMN IF NOT EXISTS position_id UUID REFERENCES career_positions(id);
