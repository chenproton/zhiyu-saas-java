SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
DROP TABLE resource_tag_relations;
DROP TABLE tags;

SET FOREIGN_KEY_CHECKS = 1;