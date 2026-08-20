SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
ALTER TABLE knowledge_points DROP COLUMN source_type;
ALTER TABLE knowledge_points DROP COLUMN source_id;

SET FOREIGN_KEY_CHECKS = 1;