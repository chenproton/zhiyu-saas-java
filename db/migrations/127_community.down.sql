SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
DROP TABLE IF EXISTS community_replies;
DROP TABLE IF EXISTS community_topics;

SET FOREIGN_KEY_CHECKS = 1;