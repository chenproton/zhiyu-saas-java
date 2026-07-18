-- 为关键枚举字段和分数/权重字段补充 CHECK 约束，防止脏数据导致状态机/计算异常

ALTER TABLE career_positions ADD CONSTRAINT chk_career_positions_status
    CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'published', 'archived'));

ALTER TABLE scenarios ADD CONSTRAINT chk_scenarios_status
    CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'published', 'archived'));

ALTER TABLE courses ADD CONSTRAINT chk_courses_status
    CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'published', 'archived'));

ALTER TABLE question_banks ADD CONSTRAINT chk_question_banks_status
    CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'published', 'archived'));

ALTER TABLE exams ADD CONSTRAINT chk_exams_status
    CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'published', 'archived'));

ALTER TABLE questions ADD CONSTRAINT chk_questions_status
    CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'published', 'archived'));

ALTER TABLE task_eval_points ADD CONSTRAINT chk_task_eval_points_max_score
    CHECK (max_score >= 0);

ALTER TABLE position_ability_bindings ADD CONSTRAINT chk_position_ability_bindings_weight
    CHECK (weight BETWEEN 0 AND 100);

ALTER TABLE scenario_weight_configs ADD CONSTRAINT chk_scenario_weight_configs_weight
    CHECK (weight BETWEEN 0 AND 100);

ALTER TABLE task_evaluation_configs ADD CONSTRAINT chk_task_evaluation_configs_weight
    CHECK (weight BETWEEN 0 AND 100);
