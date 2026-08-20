-- 专家账号体系一期回滚（数据不可恢复，仅撤结构）
DROP TABLE IF EXISTS alliance_resource_grants;
ALTER TABLE career_positions DROP COLUMN IF EXISTS source_resource_id;
ALTER TABLE scenarios DROP COLUMN IF EXISTS source_resource_id;
