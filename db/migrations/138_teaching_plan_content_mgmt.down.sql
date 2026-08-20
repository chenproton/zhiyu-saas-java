SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
ALTER TABLE teaching_plans DROP COLUMN batch_id;
ALTER TABLE teaching_plans DROP COLUMN collaborators;
ALTER TABLE teaching_plans DROP COLUMN created_by;
ALTER TABLE teaching_plans DROP COLUMN updated_at;

SET FOREIGN_KEY_CHECKS = 1;