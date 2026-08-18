-- 回滚 143：移除任务评审步骤的企业导师分配列

ALTER TABLE task_review_steps DROP COLUMN IF EXISTS assigned_user_ids;
