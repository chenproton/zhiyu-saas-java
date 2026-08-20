-- 专家账号体系一期回滚（数据不可恢复，仅撤结构）
SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
DROP TABLE IF EXISTS alliance_resource_grants;
ALTER TABLE career_positions DROP COLUMN source_resource_id;
ALTER TABLE scenarios DROP COLUMN source_resource_id;

SET FOREIGN_KEY_CHECKS = 1;