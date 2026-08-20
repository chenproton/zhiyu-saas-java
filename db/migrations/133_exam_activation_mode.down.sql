-- 考试统一生命周期：回滚启用条件列
SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
ALTER TABLE exam_usages
    DROP COLUMN activation_mode;

SET FOREIGN_KEY_CHECKS = 1;