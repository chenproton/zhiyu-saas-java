SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
DROP TABLE IF EXISTS brand_major_rank_configs;

SET FOREIGN_KEY_CHECKS = 1;