-- 123 回滚：评价标准"纯复制"语义
-- 注意：评分规则项复制到任务侧后，回滚不恢复 rubric_template_id 引用（信息已完整保留在任务侧）。

SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
DROP TABLE IF EXISTS task_eval_score_rules;

ALTER TABLE task_evaluation_methods
    DROP COLUMN standard_name,
    DROP COLUMN standard_mode;

SET FOREIGN_KEY_CHECKS = 1;