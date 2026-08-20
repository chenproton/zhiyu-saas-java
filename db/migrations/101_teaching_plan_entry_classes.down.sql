SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
DROP TABLE IF EXISTS teaching_plan_entry_classes;

SET FOREIGN_KEY_CHECKS = 1;