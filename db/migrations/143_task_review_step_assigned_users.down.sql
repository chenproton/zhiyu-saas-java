-- 回滚 143：移除任务评审步骤的企业导师分配列

SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
ALTER TABLE task_review_steps DROP COLUMN assigned_user_ids;

SET FOREIGN_KEY_CHECKS = 1;