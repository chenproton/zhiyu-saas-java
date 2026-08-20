SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
ALTER TABLE training_programs DROP COLUMN collaborators;
ALTER TABLE training_programs DROP COLUMN batch_id;

SET FOREIGN_KEY_CHECKS = 1;