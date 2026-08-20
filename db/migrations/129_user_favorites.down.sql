SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
DROP TABLE IF EXISTS user_favorites;

SET FOREIGN_KEY_CHECKS = 1;