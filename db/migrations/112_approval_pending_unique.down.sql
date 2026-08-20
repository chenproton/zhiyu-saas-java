SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
DROP INDEX uq_approval_records_target_pending ON approval_records;
ALTER TABLE approval_records DROP COLUMN pending_uniq;

SET FOREIGN_KEY_CHECKS = 1;