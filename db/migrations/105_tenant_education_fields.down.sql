SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
ALTER TABLE tenants DROP COLUMN education_level;
ALTER TABLE tenants DROP COLUMN education_nature;

SET FOREIGN_KEY_CHECKS = 1;