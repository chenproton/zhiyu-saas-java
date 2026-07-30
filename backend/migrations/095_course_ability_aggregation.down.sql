DROP INDEX IF EXISTS idx_course_eval_results_unique;
DROP INDEX IF EXISTS idx_course_eval_results_course_evaluatee;
DROP INDEX IF EXISTS idx_course_eval_results_evaluatee;
DROP INDEX IF EXISTS idx_course_eval_results_course;
DROP INDEX IF EXISTS idx_course_eval_results_tenant;
DROP TABLE IF EXISTS course_evaluation_results;
DROP INDEX IF EXISTS idx_courses_ability_point_ids;
ALTER TABLE courses DROP COLUMN IF EXISTS ability_point_ids;
