SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
CALL drop_all_fks('task_eval_points');
CALL drop_all_fks('task_review_steps');DROP INDEX idx_exam_usages_target_ids_gin ON exam_usages;
DROP INDEX idx_task_eval_points_config ON task_eval_points;
DROP INDEX idx_task_review_steps_config ON task_review_steps;

SET FOREIGN_KEY_CHECKS = 1;