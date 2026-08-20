-- 回滚 160：删除 password_changed_at 列。
SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
ALTER TABLE users DROP COLUMN password_changed_at;

SET FOREIGN_KEY_CHECKS = 1;