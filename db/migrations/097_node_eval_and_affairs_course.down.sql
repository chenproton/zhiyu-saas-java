SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
CALL drop_all_fks('node_evaluation_results');
CALL drop_all_fks('teaching_plan_entries');
CALL drop_all_fks('training_program_courses');DROP INDEX idx_node_eval_results_node_evaluatee ON node_evaluation_results;
DROP INDEX idx_node_eval_results_evaluatee ON node_evaluation_results;
DROP INDEX idx_node_eval_results_node ON node_evaluation_results;
DROP INDEX idx_node_eval_results_tenant ON node_evaluation_results;
DROP TABLE IF EXISTS node_evaluation_results;

DROP INDEX idx_training_program_courses_course ON training_program_courses;
ALTER TABLE training_program_courses DROP COLUMN course_id;

DROP INDEX idx_teaching_plan_entries_course ON teaching_plan_entries;
ALTER TABLE teaching_plan_entries DROP COLUMN course_id;

SET FOREIGN_KEY_CHECKS = 1;