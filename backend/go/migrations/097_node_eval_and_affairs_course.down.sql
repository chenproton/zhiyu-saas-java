DROP INDEX IF EXISTS idx_node_eval_results_node_evaluatee;
DROP INDEX IF EXISTS idx_node_eval_results_evaluatee;
DROP INDEX IF EXISTS idx_node_eval_results_node;
DROP INDEX IF EXISTS idx_node_eval_results_tenant;
DROP TABLE IF EXISTS node_evaluation_results;

DROP INDEX IF EXISTS idx_training_program_courses_course;
ALTER TABLE training_program_courses DROP COLUMN IF EXISTS course_id;

DROP INDEX IF EXISTS idx_teaching_plan_entries_course;
ALTER TABLE teaching_plan_entries DROP COLUMN IF EXISTS course_id;
