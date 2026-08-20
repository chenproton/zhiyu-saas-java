-- 134 down: 删除节次时段类型列
SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
ALTER TABLE period_slots DROP COLUMN slot_type;

SET FOREIGN_KEY_CHECKS = 1;