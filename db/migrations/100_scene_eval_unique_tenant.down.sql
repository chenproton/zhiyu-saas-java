SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
ALTER TABLE scene_evaluation_results DROP INDEX scene_evaluation_results_tenant_task_evaluatee_method_key;
ALTER TABLE scene_evaluation_results ADD CONSTRAINT scene_evaluation_results_task_id_evaluatee_id_method_key_key UNIQUE (task_id, evaluatee_id, method_key);

SET FOREIGN_KEY_CHECKS = 1;