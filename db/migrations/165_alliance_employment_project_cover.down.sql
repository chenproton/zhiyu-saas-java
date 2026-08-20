SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
ALTER TABLE alliance_employment_projects DROP COLUMN cover_image;

SET FOREIGN_KEY_CHECKS = 1;