-- 移除 CHECK 约束

ALTER TABLE career_positions DROP CONSTRAINT IF EXISTS chk_career_positions_status;
ALTER TABLE scenarios DROP CONSTRAINT IF EXISTS chk_scenarios_status;
ALTER TABLE courses DROP CONSTRAINT IF EXISTS chk_courses_status;
ALTER TABLE question_banks DROP CONSTRAINT IF EXISTS chk_question_banks_status;
ALTER TABLE exams DROP CONSTRAINT IF EXISTS chk_exams_status;
ALTER TABLE questions DROP CONSTRAINT IF EXISTS chk_questions_status;

ALTER TABLE task_eval_points DROP CONSTRAINT IF EXISTS chk_task_eval_points_max_score;
ALTER TABLE position_ability_bindings DROP CONSTRAINT IF EXISTS chk_position_ability_bindings_weight;
ALTER TABLE scenario_weight_configs DROP CONSTRAINT IF EXISTS chk_scenario_weight_configs_weight;
ALTER TABLE task_evaluation_configs DROP CONSTRAINT IF EXISTS chk_task_evaluation_configs_weight;
