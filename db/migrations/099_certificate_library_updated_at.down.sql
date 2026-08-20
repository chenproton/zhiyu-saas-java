SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
ALTER TABLE certificate_library DROP COLUMN updated_at;

SET FOREIGN_KEY_CHECKS = 1;