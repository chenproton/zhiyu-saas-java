SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
CALL drop_all_fks('course_evaluation_results');DROP INDEX idx_course_eval_results_unique ON course_evaluation_results;
DROP INDEX idx_course_eval_results_course_evaluatee ON course_evaluation_results;
DROP INDEX idx_course_eval_results_evaluatee ON course_evaluation_results;
DROP INDEX idx_course_eval_results_course ON course_evaluation_results;
DROP INDEX idx_course_eval_results_tenant ON course_evaluation_results;
DROP TABLE IF EXISTS course_evaluation_results;
DROP INDEX idx_courses_ability_point_ids ON courses;
ALTER TABLE courses DROP COLUMN ability_point_ids;

SET FOREIGN_KEY_CHECKS = 1;