-- 回滚 142_partner_enterprise：
-- 删新表 → experts 删 user_id → 企业主体回改表名并还原删掉的列 → 删 tenants.type。
-- 注意：up 中 TRUNCATE 清空的联盟开发数据不可逆（无法通过本回滚恢复）。

DROP TABLE IF EXISTS alliance_expert_mentor_links;
DROP TABLE IF EXISTS alliance_enterprise_links;

ALTER TABLE alliance_experts DROP COLUMN IF EXISTS user_id;
DROP INDEX IF EXISTS idx_alliance_experts_enterprise;

-- ===== 企业主体回改：partner_enterprises → alliance_enterprises =====
ALTER TABLE partner_enterprises DROP CONSTRAINT IF EXISTS partner_enterprises_name_key;
ALTER TABLE partner_enterprises DROP COLUMN IF EXISTS enable_public;

ALTER TABLE partner_enterprises ADD COLUMN IF NOT EXISTS enterprise_type varchar(32) NOT NULL DEFAULT 'platform';
ALTER TABLE partner_enterprises ADD COLUMN IF NOT EXISTS rating varchar(32) DEFAULT 'general';
ALTER TABLE partner_enterprises ADD COLUMN IF NOT EXISTS status varchar(32) NOT NULL DEFAULT 'negotiating';
ALTER TABLE partner_enterprises ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
ALTER TABLE partner_enterprises ADD COLUMN IF NOT EXISTS secondary_colleges jsonb DEFAULT '[]';
ALTER TABLE partner_enterprises ADD COLUMN IF NOT EXISTS rating_record jsonb;
ALTER TABLE partner_enterprises ADD COLUMN IF NOT EXISTS created_by uuid;

DROP INDEX IF EXISTS idx_partner_enterprises_tenant;
ALTER TABLE partner_enterprises RENAME TO alliance_enterprises;

CREATE INDEX IF NOT EXISTS idx_alliance_enterprises_tenant_status ON alliance_enterprises(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_alliance_enterprises_tenant_rating ON alliance_enterprises(tenant_id, rating);

ALTER TABLE tenants DROP COLUMN IF EXISTS type;
