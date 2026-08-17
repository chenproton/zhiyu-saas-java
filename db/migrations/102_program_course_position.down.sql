ALTER TABLE training_program_courses DROP COLUMN IF EXISTS position_id;
ALTER TABLE training_program_courses ADD COLUMN IF NOT EXISTS scenario_id UUID REFERENCES scenarios(id);
